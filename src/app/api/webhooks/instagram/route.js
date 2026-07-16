import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { generateReply, classifyIncomingMessage } from "@/lib/anthropic";
import { buildSystemPrompt } from "@/lib/prompts";
import { sendInstagramMessage, verifyWebhookSignature, getParticipantProfile } from "@/lib/instagram";
import { decryptToken } from "@/lib/token-utils";
import { sendHotLeadAlert, sendBookingAlert } from "@/lib/notifications";
import { getPostHogClient } from "@/lib/posthog-server";
import { log } from "@/lib/logger";
import { handleCommentEvent } from "@/lib/webhooks/comment-event";
import {
  classifyDMIntent,
  DM_INTENT_VERSION,
  DO_NOT_SEND_PAUSE_THRESHOLD,
  VOICE_ROUTING_THRESHOLD,
} from "@/lib/dm-intent";
import { findVoiceSnippetForIntent, getSendableAudioUrl } from "@/lib/voice/matcher";
import { sendVoiceMessage, logVoiceSend } from "@/lib/voice/sender";

// ── GET: Meta webhook verification ──────────────────────────────────────

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  // Meta webhook verification handshake
  if (mode === "subscribe" && token === process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }

  // Health check
  return NextResponse.json({ status: "ok" }, { status: 200 });
}

// ── POST: Handle incoming Instagram messages via Meta Graph API ─────────

export async function POST(request) {
  try {
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);

    if (body.object === "instagram") {
      return handleMetaWebhook(body, rawBody, request);
    }

    return NextResponse.json({ status: "ignored" }, { status: 200 });
  } catch (error) {
    console.error("Webhook POST error:", error);
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }
}

// ── Meta Instagram Messaging webhook ────────────────────────────────────

async function handleMetaWebhook(body, rawBody, request) {
  // ── HMAC verification (fail-closed) ───────────────────────────────────
  // Previously this branch logged a warning and accepted unverified bodies
  // when INSTAGRAM_APP_SECRET was unset. A misconfigured deploy would then
  // accept spoofed comment payloads. Now we 403 in every failure case.
  //
  // Dev escape hatch: when NODE_ENV !== "production" AND the request carries
  // x-clinchd-dev-bypass matching WEBHOOK_DEV_BYPASS_TOKEN, accept the body.
  // Lets the local simulation script POST without computing real HMACs.
  const signature = request.headers.get("x-hub-signature-256");
  const devBypassHeader = request.headers.get("x-clinchd-dev-bypass");
  const devBypassToken = process.env.WEBHOOK_DEV_BYPASS_TOKEN;
  const devBypassAllowed =
    process.env.NODE_ENV !== "production" &&
    devBypassToken &&
    devBypassHeader &&
    devBypassHeader === devBypassToken;

  if (devBypassAllowed) {
    console.warn("[webhook] HMAC bypassed via x-clinchd-dev-bypass (non-production)");
  } else if (!process.env.INSTAGRAM_APP_SECRET) {
    console.error("[webhook] HMAC verification failed:", { reason: "missing_secret" });
    return new Response("Forbidden", { status: 403 });
  } else if (!signature) {
    console.error("[webhook] HMAC verification failed:", { reason: "missing_signature" });
    return new Response("Forbidden", { status: 403 });
  } else if (!verifyWebhookSignature(rawBody, signature)) {
    console.error("[webhook] HMAC verification failed:", { reason: "invalid_signature" });
    return new Response("Forbidden", { status: 403 });
  }

  const entries = body.entry || [];

  for (const entry of entries) {
    // ── comments branch ────────────────────────────────────────────────
    // Meta delivers comment events under entry.changes (not entry.messaging).
    // handleCommentEvent does its own try/catch and never throws — keep this
    // loop fast so we 200 OK before Meta retries.
    for (const change of entry.changes || []) {
      if (change.field === "comments") {
        await handleCommentEvent(entry, change);
      }
    }

    const messaging = entry.messaging || [];

    for (const event of messaging) {
      // Only process text messages (not reads, reactions, etc.)
      if (!event.message?.text) continue;

      // Echo messages (sent BY the connected account — both API-sent replies
      // and DMs the coach types manually in the Instagram app) are persisted
      // for AI context, never processed. INVARIANT: the echo branch must
      // never fall through into intent classification, reply generation, or
      // any send path — otherwise the agent could react to its own messages.
      if (event.message?.is_echo) {
        await handleEchoEvent(event);
        continue;
      }

      const igAccountId = event.recipient?.id; // Our Instagram Business Account ID
      const senderId = event.sender?.id; // The person who DM'd us (IGSID)
      const messageText = event.message.text;

      if (!igAccountId || !senderId || !messageText) continue;

      try {
        // Fetch sender's name from Instagram API
        // We need the user's access token — look up user first
        const supabaseForName = getSupabaseAdmin();
        // maybeSingle: zero rows → null (processIncomingMessage logs that
        // case); 2+ rows → PGRST116 error, which must surface as an ERROR
        // here, never be conflated with "no user".
        const { data: ownerUser, error: ownerLookupError } =
          await supabaseForName
            .from("users")
            .select("meta_page_access_token")
            .eq("instagram_business_account_id", igAccountId)
            .maybeSingle();
        if (ownerLookupError) {
          log.error(
            `[resolver:inbound-name] lookup ERROR for igba=${igAccountId}: ${ownerLookupError.code} ${ownerLookupError.message}`
          );
        }

        let senderName = null;
        let senderUsername = null;
        if (ownerUser?.meta_page_access_token) {
          const pageToken = decryptToken(ownerUser.meta_page_access_token);
          const profile = await getParticipantProfile(senderId, pageToken);
          senderName = profile?.name || profile?.username || null;
          senderUsername = profile?.username || null;
        }

        await processIncomingMessage({
          lookupField: "instagram_business_account_id",
          lookupValue: igAccountId,
          senderId,
          messageText,
          senderName,
          senderUsername,
          providerMessageId: event.message?.mid || null,
        });
      } catch (err) {
        console.error("Error processing Meta message:", err);
      }
    }
  }

  return NextResponse.json({ status: "ok" }, { status: 200 });
}

// ── Helpers ─────────────────────────────────────────────────────────────

// Mark a conversation's `last_skip_reason` so the dashboard can explain why
// the agent didn't reply on a given turn. Cleared by the success path.
async function markSkip(supabase, conversation_id, reason) {
  const { error } = await supabase
    .from("conversations")
    .update({ last_skip_reason: reason })
    .eq("id", conversation_id);
  if (error) log.error("[webhook] markSkip failed:", error.code);
}

// User-level gates fire before we look up/create a conversation. If a row
// already exists for this sender we still want to surface the reason on it;
// otherwise we silently no-op (no conversation yet to annotate).
async function markSkipForSender(supabase, user_id, sender_id, reason) {
  const { error } = await supabase
    .from("conversations")
    .update({ last_skip_reason: reason })
    .eq("user_id", user_id)
    .eq("instagram_sender_id", sender_id);
  if (error) log.error("[webhook] markSkipForSender failed:", error.code);
}

// Map a do_not_send classification to a specific, debuggable pause reason.
// Previously every do_not_send pause flattened to 'hostile_or_refund', which
// mislabeled benign-but-suspicious flags. Concretely: the อัศวิน thread was a
// coach who DM'd Dom and whose message echoed coach-outreach-script language;
// the classifier correctly flagged it do_not_send with signals
// ['echoes_coach_script', ...], but the DB recorded ai_pause_reason=
// 'hostile_or_refund', implying hostility that wasn't there. We now preserve
// the most specific signal so the dashboard reason chip is accurate. This is a
// debuggability change only — it does NOT alter whether the AI pauses, and it
// does NOT touch the classifier's signal definitions (see src/lib/dm-intent.js).
//
// Priority order matters: a message that is BOTH hostile and script-echoing is
// hostility first. Prompt injection is the most severe and wins outright.
const DO_NOT_SEND_REASON_RULES = [
  { reason: "prompt_injection", signals: ["prompt_injection_attempt"] },
  {
    reason: "hostile_or_refund",
    signals: [
      "refund_demand", "chargeback_threat", "scam_accusation", "legal_threat",
      "hate_speech", "hostile", "abuse", "abusive", "crisis_signal",
      "self_harm", "suicide", "threat",
    ],
  },
  {
    reason: "flagged_coach_script",
    signals: ["echoes_coach_script", "suspicious_pattern", "likely_test_or_probe"],
  },
];

function pauseReasonForDoNotSend(signals) {
  const sigs = Array.isArray(signals)
    ? signals.map((s) => String(s).toLowerCase())
    : [];
  for (const rule of DO_NOT_SEND_REASON_RULES) {
    if (rule.signals.some((s) => sigs.includes(s))) return rule.reason;
  }
  // No recognized signal — keep a generic do_not_send marker rather than
  // overstating it as hostility. 'hostile_or_refund' is reserved for the
  // hostility/refund signal set above.
  return "flagged_do_not_send";
}

// v1 qualifying-loop detector. Heuristic, no embeddings:
// looks at the last 3 agent + last 3 lead messages and returns true when
//   - all 3 agent messages contain question marks, AND
//   - they share 3+ identical content words (lowercase tokens >=4 chars,
//     stopwords removed) — e.g. three rephrasings of "what's your offer"
//     will keep "offer" in the intersection, three "who's your audience"
//     attempts will keep "audience", and so on, AND
//   - all 3 lead replies are < 15 words, AND
//   - no lead reply names a substantive offer or target-customer noun.
//
// `messages` is the full ordered conversation history (oldest → newest).
// The most recent inbound message MUST already be included.
const LOOP_STOPWORDS = new Set([
  "what", "whats", "that", "this", "those", "these",
  "have", "having", "your", "yours", "youre", "youve",
  "with", "from", "about", "around", "into",
  "would", "could", "should", "might", "really", "actually",
  "just", "well", "like", "okay", "yeah", "sure",
  "right", "going", "kind", "sort", "tell", "share", "let",
  "want", "need", "hey", "hello", "thanks", "thank",
  "today", "lately", "recently", "currently", "happy",
  "more", "than", "then", "when", "where", "which", "still",
  "also", "much", "many", "some", "make", "made",
]);
const SUBSTANTIVE_LEAD_TOKENS = [
  "sell", "selling", "sold",
  "offer", "offering",
  "program", "course", "ebook", "membership", "mentorship", "mastermind",
  "coach", "coaching",
  "consult", "consulting",
  "service", "services",
  "product", "products",
  "agency",
  "saas",
  "subscription",
  "store",
  "brand",
  "audience",
  "client", "clients",
  "target",
  "ideal customer",
  "niche",
  "business",
];

function detectQualifyingLoop(messages) {
  if (!Array.isArray(messages) || messages.length < 6) return false;

  const agentMsgs = messages
    .filter((m) => m.role === "assistant" && typeof m.content === "string")
    .slice(-3);
  const leadMsgs = messages
    .filter((m) => m.role === "user" && typeof m.content === "string")
    .slice(-3);
  if (agentMsgs.length < 3 || leadMsgs.length < 3) return false;

  if (!agentMsgs.every((m) => m.content.includes("?"))) return false;

  const wordSets = agentMsgs.map((m) => {
    const tokens = m.content.toLowerCase().match(/[a-z']+/g) || [];
    return new Set(
      tokens.filter((t) => t.length >= 4 && !LOOP_STOPWORDS.has(t))
    );
  });
  const shared = [...wordSets[0]].filter(
    (w) => wordSets[1].has(w) && wordSets[2].has(w)
  );
  if (shared.length < 3) return false;

  for (const lead of leadMsgs) {
    const text = (lead.content || "").trim();
    const words = text.match(/\S+/g) || [];
    if (words.length >= 15) return false;
    const lower = text.toLowerCase();
    if (SUBSTANTIVE_LEAD_TOKENS.some((tok) => lower.includes(tok))) return false;
  }

  return true;
}

async function insertMessageIfNew(supabase, { conversation_id, role, content, provider_message_id, source }) {
  if (provider_message_id) {
    const { data: existing } = await supabase
      .from("messages")
      .select("id")
      .eq("provider_message_id", provider_message_id)
      .maybeSingle();
    if (existing) return { duplicate: true };
  }
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id, role, content, provider_message_id, source })
    .select()
    .single();
  if (error?.code === "23505") return { duplicate: true };
  if (error) {
    log.error("[webhook] message insert failed:", { conversation_id, role, code: error.code });
  }
  // Set last_message_at to this message's own created_at so the canonical
  // recency field always equals the newest message (and the inbox reorders /
  // realtime fires). Only bumped here, on a genuine message insert.
  const { error: bumpError } = await supabase
    .from("conversations")
    .update({ last_message_at: data?.created_at || new Date().toISOString() })
    .eq("id", conversation_id);
  if (bumpError) log.error("[webhook] conversation bump failed:", bumpError.code);
  return { data, error, duplicate: false };
}

// ── Echo capture ────────────────────────────────────────────────────────
// Echo events (message.is_echo) are messages SENT BY the connected business
// account: replies this app sends via the API AND DMs the coach types
// manually in the Instagram app. Persisting them makes manually-sent openers
// visible to the AI automatically, so the Native Send pre-log becomes a
// fallback instead of a requirement.
//
// INVARIANT: this handler only persists. It must never trigger intent
// classification, reply generation, or any send — the loop-prevention
// guarantee that keeps the agent from reacting to its own messages.
// Defensive throughout: a malformed echo payload logs and returns, never
// throws into the webhook loop.
async function handleEchoEvent(event) {
  try {
    // For echoes the SENDER is the business account and the RECIPIENT is the
    // prospect — inverted relative to inbound events.
    const igAccountId = event.sender?.id;
    const recipientId = event.recipient?.id;
    const messageText = event.message?.text;
    const mid = event.message?.mid || null;
    if (!igAccountId || !recipientId || !messageText) return;

    // TEMP: echo verification, remove after confirming manual echoes arrive
    console.log("[webhook] echo received:", {
      is_echo: true,
      mid,
      sender: igAccountId,
      recipient: recipientId,
    });

    const supabase = getSupabaseAdmin();

    // maybeSingle distinguishes the two failure shapes: zero rows → data
    // null (genuinely no user); 2+ rows → PGRST116 error (duplicate
    // identity rows). Conflating them hid the July duplicate-IGBA
    // incidents — the error case must log as an ERROR, not "no user".
    const { data: user, error: echoLookupError } = await supabase
      .from("users")
      .select("id, email, meta_page_access_token")
      .eq("instagram_business_account_id", igAccountId)
      .maybeSingle();
    if (echoLookupError) {
      log.error(
        `[resolver:echo] lookup ERROR for igba=${igAccountId}: ${echoLookupError.code} ${echoLookupError.message}`
      );
      return;
    }
    if (!user) {
      log.warn(`[resolver:echo] no user for igba=${igAccountId}`);
      return;
    }

    // Find or create the conversation keyed on the prospect's IGSID — the
    // same key the inbound path uses, so the thread lines up when the
    // prospect replies.
    let conversation;
    let conversationWasJustCreated = false;

    const { data: conv } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_id", user.id)
      .eq("instagram_sender_id", recipientId)
      .maybeSingle();
    conversation = conv;

    if (!conversation) {
      // Outbound-first thread. Best-effort prospect name lookup, mirroring
      // the inbound path.
      let senderName = null;
      if (user.meta_page_access_token) {
        try {
          const pageToken = decryptToken(user.meta_page_access_token);
          const profile = await getParticipantProfile(recipientId, pageToken);
          senderName = profile?.name || profile?.username || null;
        } catch (err) {
          log.warn("[webhook] echo profile lookup failed:", err?.message);
        }
      }

      const { data: newConv, error: createError } = await supabase
        .from("conversations")
        .insert({
          user_id: user.id,
          instagram_sender_id: recipientId,
          instagram_thread_id: recipientId,
          status: "qualifying",
          ai_paused: false,
          sender_name: senderName,
          // Born from a manually-sent DM — same semantics as the Native Send
          // pre-log path, so NATIVE_SEND_PREFIX fires when the prospect
          // replies (src/lib/prompts.js).
          origin: "native_send",
        })
        .select()
        .single();
      if (createError) {
        log.error("[webhook] echo create conversation failed:", createError.code);
        return;
      }
      getPostHogClient().capture({
        distinctId: user.email || user.id,
        event: "conversation_created",
        properties: {
          conversation_id: newConv.id,
          sender_name: senderName,
          via: "echo",
        },
      });
      conversation = newConv;
      conversationWasJustCreated = true;
    }

    // Reconcile with a Native Send pre-log: if the coach ALSO pre-logged this
    // DM, claim the row so it never sits orphaned and the inbound path can't
    // inject a second opener later — but do NOT insert its dm_text; the echo
    // below is the authoritative copy. Net effect when both paths fire:
    // exactly one opener row, zero orphaned pre-log rows.
    if (conversationWasJustCreated) {
      const { error: matchError } = await supabase.rpc(
        "match_and_claim_native_send",
        {
          p_user_id: user.id,
          p_conversation_id: conversation.id,
          p_recipient_ig_user_id: recipientId,
          p_recipient_handle: null,
        }
      );
      if (matchError) {
        log.warn("[webhook] echo native_send claim failed:", matchError.code);
      }
    }

    // Some app-sent rows don't carry a mid at echo time: drip nudges insert
    // with a null mid (processor is out of scope to change), and API replies
    // are stamped only after the send returns, so the echo can win that race.
    // If a recent assistant row has identical content and no mid, stamp the
    // echo's mid on it instead of inserting a duplicate.
    if (mid) {
      const { data: recentAssistant } = await supabase
        .from("messages")
        .select("id, content, provider_message_id")
        .eq("conversation_id", conversation.id)
        .eq("role", "assistant")
        .order("created_at", { ascending: false })
        .limit(5);
      const appSentTwin = (recentAssistant || []).find(
        (m) => !m.provider_message_id && m.content === messageText
      );
      if (appSentTwin) {
        const { error: stampError } = await supabase
          .from("messages")
          .update({ provider_message_id: mid })
          .eq("id", appSentTwin.id);
        if (stampError) log.warn("[webhook] echo twin stamp failed:", stampError.code);
        return;
      }
    }

    // role MUST be 'assistant': drip's 24h-window math and
    // detectQualifyingLoop both treat role='user' as "the lead spoke".
    await insertMessageIfNew(supabase, {
      conversation_id: conversation.id,
      role: "assistant",
      content: messageText,
      provider_message_id: mid,
      source: "manual",
    });
  } catch (err) {
    console.error("Error processing echo event:", err?.message);
  }
}

// Native Send bridge: when a conversation is first created from an inbound
// reply, check whether the user pre-logged a manual cold DM to this lead. If
// matched, inject the original outbound as the first assistant message so the
// AI sees both turns on its first generation. If not matched, flag the
// conversation so the dashboard can surface a backfill banner.
//
// Runs only on the first inbound that creates a conversation. Subsequent
// replies skip this path so a 2nd reply never re-matches a different unmatched
// native-send record.
async function attachNativeSendContext(supabase, {
  userId,
  userEmail,
  conversationId,
  senderId,
  senderUsername,
}) {
  try {
    const { data: claimed, error: matchError } = await supabase.rpc(
      "match_and_claim_native_send",
      {
        p_user_id: userId,
        p_conversation_id: conversationId,
        p_recipient_ig_user_id: senderId || null,
        p_recipient_handle: senderUsername || null,
      }
    );

    if (matchError) {
      log.warn("[webhook] native_send match RPC failed:", matchError.code);
      return { matched: false, missing: false };
    }

    const row = Array.isArray(claimed) && claimed.length > 0 ? claimed[0] : null;

    if (!row) {
      // Flag the conversation for backfill, but ONLY on an outbound-initiated
      // origin. Inbound-initiated threads (origin='inbound') must NEVER fire
      // the orange "paste the DM you sent" banner — the lead messaged the
      // coach first, so there is no missing outbound DM to backfill. Scoping
      // the update to the outbound origins ('clinchd_sent','native_send')
      // excludes inbound by construction and is the core fix for the
      // inbound-DM misclassification bug. (See migration
      // 20260604120000_conversation_origin_inbound for context.)
      const { data: flagged, error: flagError } = await supabase
        .from("conversations")
        .update({ missing_outbound_context: true })
        .eq("id", conversationId)
        .in("origin", ["clinchd_sent", "native_send"])
        .select("id");
      if (flagError) {
        log.error("[webhook] flag missing_outbound_context failed:", flagError.code);
        return { matched: false, missing: false };
      }
      if (!flagged || flagged.length === 0) {
        // A racing path already matched this conversation. Nothing to do.
        return { matched: false, missing: false };
      }
      getPostHogClient().capture({
        distinctId: userEmail || userId,
        event: "native_send_missing_context",
        properties: { conversation_id: conversationId },
      });
      return { matched: false, missing: true };
    }

    // Inject the original outbound as the first message in the thread. Use the
    // original sent_at as created_at so it sorts before the lead's reply when
    // history is loaded with ORDER BY created_at ASC.
    const { error: injectError } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: row.dm_text,
      source: "native_send",
      created_at: row.sent_at,
    });
    if (injectError) {
      log.error("[webhook] native_send message inject failed:", injectError.code);
      return { matched: false, missing: false };
    }

    const { error: originError } = await supabase
      .from("conversations")
      .update({ origin: "native_send", missing_outbound_context: false })
      .eq("id", conversationId);
    if (originError) {
      log.error("[webhook] set conversation origin failed:", originError.code);
      return { matched: false, missing: false };
    }

    getPostHogClient().capture({
      distinctId: userEmail || userId,
      event: "native_send_matched",
      properties: {
        conversation_id: conversationId,
        native_send_id: row.id,
      },
    });
    return { matched: true, missing: false };
  } catch (err) {
    log.error("[webhook] attachNativeSendContext threw:", err?.message);
    return { matched: false, missing: false };
  }
}

// ── Shared message processing logic ─────────────────────────────────────

async function processIncomingMessage({
  lookupField,
  lookupValue,
  senderId,
  messageText,
  senderName,
  senderUsername,
  providerMessageId,
}) {
  const supabase = getSupabaseAdmin();

  // Look up user. maybeSingle distinguishes the two failure shapes: zero
  // rows → data null (genuinely no user); 2+ rows → PGRST116 error
  // (duplicate identity rows). The old .single() conflated both into one
  // "no user" log line, which hid the July duplicate-IGBA incidents —
  // duplicates must log as an ERROR, never as "no user".
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("*")
    .eq(lookupField, lookupValue)
    .maybeSingle();

  if (userError) {
    log.error(
      `[resolver:inbound] lookup ERROR for ${lookupField}=${lookupValue}: ${userError.code} ${userError.message}`
    );
    return;
  }
  if (!user) {
    log.warn(`[resolver:inbound] no user for ${lookupField}=${lookupValue}`);
    return;
  }

  if (!["active", "trialing"].includes(user.subscription_status)) {
    await markSkipForSender(supabase, user.id, senderId, "subscription_inactive");
    return;
  }

  // Fix #1: Check trial expiry
  if (user.subscription_status === "trialing") {
    const trialEnd = user.trial_ends_at ? new Date(user.trial_ends_at) : null;
    if (trialEnd && new Date() > trialEnd) {
      await supabase
        .from("users")
        .update({ subscription_status: "expired", ai_mode: "off" })
        .eq("id", user.id);
      await markSkipForSender(supabase, user.id, senderId, "trial_expired");
      return;
    }
  }

  // Lazy-reset monthly DM count
  const now = new Date();
  const resetAt = user.dm_count_reset_at ? new Date(user.dm_count_reset_at) : null;
  if (
    !resetAt ||
    now.getMonth() !== resetAt.getMonth() ||
    now.getFullYear() !== resetAt.getFullYear()
  ) {
    await supabase
      .from("users")
      .update({ dm_count_this_month: 0, dm_count_reset_at: now.toISOString() })
      .eq("id", user.id);
    user.dm_count_this_month = 0;
  }

  // Find or create conversation by instagram_sender_id
  let conversation;
  let conversationWasJustCreated = false;

  const { data: conv } = await supabase
    .from("conversations")
    .select("*")
    .eq("user_id", user.id)
    .eq("instagram_sender_id", senderId)
    .maybeSingle();
  conversation = conv;

  if (!conversation) {
    const { data: newConv, error: createError } = await supabase
      .from("conversations")
      .insert({
        user_id: user.id,
        instagram_sender_id: senderId,
        instagram_thread_id: senderId,
        status: "qualifying",
        ai_paused: false,
        sender_name: senderName,
        // This conversation is born from an inbound DM (the lead messaged the
        // coach first), so it is inbound-initiated. Set origin explicitly
        // instead of inheriting the 'clinchd_sent' column default — that
        // default assumed every conversation was outbound and made genuine
        // inbound threads (e.g. a coach DMing Dom after a follow) get flagged
        // missing_outbound_context=true and fire the orange backfill banner.
        // See migration 20260604120000_conversation_origin_inbound for context.
        origin: "inbound",
      })
      .select()
      .single();

    if (createError) {
      log.error("[webhook] create conversation failed:", createError.code);
      return;
    }
    getPostHogClient().capture({
      distinctId: user.email || user.id,
      event: "conversation_created",
      properties: { conversation_id: newConv.id, sender_name: senderName },
    });
    conversation = newConv;
    conversationWasJustCreated = true;
  }

  // Native Send context bridge — runs once, on conversation creation. Sets
  // origin='native_send' on match, or missing_outbound_context=true on miss.
  // Must run BEFORE history load so generateReply sees both turns on its
  // first call for this lead. We patch the local conversation object so step
  // 3 (system prompt) reads the updated origin without a refetch.
  if (conversationWasJustCreated) {
    const result = await attachNativeSendContext(supabase, {
      userId: user.id,
      userEmail: user.email,
      conversationId: conversation.id,
      senderId,
      senderUsername,
    });
    if (result?.matched) {
      conversation.origin = "native_send";
      conversation.missing_outbound_context = false;
    } else if (result?.missing) {
      conversation.missing_outbound_context = true;
    }
  }

  // ── Global AI mode gate ─────────────────────────────────────────────
  // 'off'     → complete silence: return without saving anything
  // 'handoff' → save inbound message for dashboard, but skip AI reply
  // 'active'  → full processing (may still be paused per-conversation)
  if (user.ai_mode === "off") return;

  if (user.ai_mode === "handoff" || conversation.ai_paused) {
    await insertMessageIfNew(supabase, {
      conversation_id: conversation.id,
      role: "user",
      content: messageText,
      provider_message_id: providerMessageId,
      source: "lead",
    });
    return;
  }

  // Skip if no script configured
  const sc = user.script_config || {};
  if (!sc.greeting) {
    await insertMessageIfNew(supabase, {
      conversation_id: conversation.id,
      role: "user",
      content: messageText,
      provider_message_id: providerMessageId,
      source: "lead",
    });
    await markSkip(supabase, conversation.id, "no_greeting");
    return;
  }

  // Atomic DM limit check — increment first, then verify
  const dmLimit = user.plan === "unlimited" ? Infinity : 1500;
  if (dmLimit !== Infinity) {
    const { data: newCount, error: rpcError } = await supabase.rpc("increment_dm_count", { uid: user.id });
    if (rpcError) {
      log.error("increment_dm_count failed:", rpcError.code);
      return;
    }
    if (newCount > dmLimit) {
      await insertMessageIfNew(supabase, {
        conversation_id: conversation.id,
        role: "user",
        content: messageText,
        provider_message_id: providerMessageId,
        source: "lead",
      });
      await markSkip(supabase, conversation.id, "dm_limit");
      return;
    }
  }

  // Save incoming message (with deduplication)
  const insertResult = await insertMessageIfNew(supabase, {
    conversation_id: conversation.id,
    role: "user",
    content: messageText,
    provider_message_id: providerMessageId,
    source: "lead",
  });
  if (insertResult.duplicate) return;

  // Drip cancel (Insertion D)
  // A genuine new inbound from the lead → cancel any scheduled follow-up
  // nudge for this conversation. Runs here (after dedupe, BEFORE the intent
  // classifier) so a lead reply always cancels the nudge even if the
  // classifier later throws. Best-effort: never blocks the reply path.
  try {
    const { cancelDripForConversation } = await import("@/lib/drip/queue");
    const canceled = await cancelDripForConversation(conversation.id, "lead_replied");
    if (canceled > 0) {
      getPostHogClient().capture({
        distinctId: user.email || user.id,
        event: "drip_canceled",
        properties: {
          conversation_id: conversation.id,
          reason: "lead_replied",
          count: canceled,
        },
      });
    }
  } catch (err) {
    log.warn("[webhook] drip cancel failed:", err?.message);
  }

  getPostHogClient().capture({
    distinctId: user.email || user.id,
    event: "message_received",
    properties: { conversation_id: conversation.id, message_length: messageText.length },
  });

  // Natural delay
  await new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000));

  // Fetch conversation history — newest 20 rows, restored to chronological
  // order. Ascending+limit returned the OLDEST 20, so threads longer than 20
  // messages dropped the newest inbound from context (and violated
  // detectQualifyingLoop's contract that the latest inbound is included).
  const { data: messagesDesc, error: msgError } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (msgError) {
    log.error("fetch messages failed:", msgError.code);
    return;
  }

  const messages = (messagesDesc || []).reverse();

  // Qualifying-loop guard. If the agent has already asked the same kind of
  // qualifying question 3 turns in a row and the lead has never given a
  // substantive answer, pause the conversation rather than fire a 4th attempt.
  if (detectQualifyingLoop(messages)) {
    await supabase
      .from("conversations")
      .update({
        ai_paused: true,
        ai_pause_reason: "qualifying_loop_detected",
        last_skip_reason: "qualifying_loop_detected",
      })
      .eq("id", conversation.id);
    getPostHogClient().capture({
      distinctId: user.email || user.id,
      event: "qualifying_loop_detected",
      properties: { conversation_id: conversation.id },
    });
    return;
  }

  // Human-in-loop: when enabled, classify the incoming message. If the
  // classifier flags it as a complex/novel objection, pause the AI and mark
  // the conversation so the dashboard surfaces it. Fail-open on any error —
  // we prefer a pass-through reply over a blocked conversation.
  if (sc.human_in_loop) {
    try {
      const classification = await classifyIncomingMessage(
        messageText,
        messages,
        sc
      );
      if (classification.needs_human) {
        await supabase
          .from("conversations")
          .update({
            ai_paused: true,
            ai_pause_reason: "complex_objection",
          })
          .eq("id", conversation.id);
        getPostHogClient().capture({
          distinctId: user.email || user.id,
          event: "human_in_loop_triggered",
          properties: { conversation_id: conversation.id, reason: classification.reason },
        });
        return;
      }
    } catch (err) {
      log.warn("[webhook] classifier failed, falling through:", err?.message);
    }
  }

  // ── DM intent classifier (always-on) ────────────────────────────────
  // Runs regardless of human_in_loop. Used for voice routing below and
  // for persisting an intent label on the messages row (powers the
  // future Inbox Insights view). Split into three independent try blocks
  // so a failure in persistence or telemetry doesn't kill the others.
  // Fail-open across the board — the existing text reply path is the
  // safety net.

  // 1) Classify. The critical call. If this throws, dmIntent stays null
  //    and voice routing short-circuits below.
  let dmIntent = null;
  try {
    dmIntent = await classifyDMIntent({
      messageText,
      recentMessages: messages,
      scriptConfig: sc,
      offer: sc.offer,
    });
  } catch (err) {
    log.warn("[webhook] dm intent classifier failed, falling through:", err?.message);
  }

  // 2) Persist. Best-effort write to messages.intent_classification.
  //    A failure here (row not yet committed, provider_message_id absent)
  //    does NOT block the PostHog capture below or downstream routing.
  if (dmIntent && providerMessageId) {
    try {
      await supabase
        .from("messages")
        .update({
          intent_classification: {
            class: dmIntent.class,
            confidence: dmIntent.confidence,
            language: dmIntent.language,
            reasoning: dmIntent.reasoning,
            signals: dmIntent.signals,
            version: DM_INTENT_VERSION,
          },
        })
        .eq("conversation_id", conversation.id)
        .eq("provider_message_id", providerMessageId);
    } catch (err) {
      log.warn("[webhook] failed to persist intent_classification:", err?.message);
    }
  }

  // 3) Telemetry. Best-effort PostHog capture. Independent so a transient
  //    PostHog failure doesn't lose the classification or block routing.
  if (dmIntent) {
    try {
      getPostHogClient().capture({
        distinctId: user.email || user.id,
        event: "dm_intent_classified",
        properties: {
          conversation_id: conversation.id,
          intent_class: dmIntent.class,
          confidence: dmIntent.confidence,
          language: dmIntent.language,
          latency_ms: dmIntent.latencyMs,
          input_tokens: dmIntent.inputTokens,
          output_tokens: dmIntent.outputTokens,
          cache_read_tokens: dmIntent.cacheReadTokens,
          cache_write_tokens: dmIntent.cacheWriteTokens,
        },
      });
    } catch (err) {
      log.warn("[webhook] posthog capture failed:", err?.message);
    }
  }

  // Drip enqueue helper (Insertion C)
  // Schedules a single in-window follow-up nudge after a successful AI reply
  // (text OR voice). Called from both reply paths below with the conversation's
  // effective status. Gates:
  //   - drip_enabled must be true (the deploy-dark safety — no nudge is
  //     scheduled for anyone until they opt in, founder included)
  //   - the classified intent must be one of the 6 nudge-eligible classes.
  //     do_not_send is excluded here (defense in depth — the do_not_send
  //     branch already returns before either reply path runs)
  //   - the conversation must still be in a follow-up-eligible status
  // Best-effort: never throws into the reply path. enqueueDrip itself returns
  // null (no throw) if a nudge is already scheduled for this conversation.
  const DRIP_ELIGIBLE_CLASSES = [
    "warm_intent",
    "objection_price",
    "objection_time",
    "objection_trust",
    "booking_cta",
    "follow_up",
  ];
  async function maybeEnqueueDrip(effectiveStatus) {
    if (
      user.drip_enabled !== true ||
      !dmIntent ||
      !DRIP_ELIGIBLE_CLASSES.includes(dmIntent.class) ||
      !["qualifying", "interested"].includes(effectiveStatus)
    ) {
      return;
    }
    try {
      const { enqueueDrip } = await import("@/lib/drip/queue");
      const enqueued = await enqueueDrip({
        userId: user.id,
        conversationId: conversation.id,
        recipientPsid: senderId,
        intentClass: dmIntent.class,
        delayHours: user.drip_delay_hours || 18,
      });
      if (enqueued) {
        getPostHogClient().capture({
          distinctId: user.email || user.id,
          event: "drip_scheduled",
          properties: {
            conversation_id: conversation.id,
            intent_class: dmIntent.class,
            delay_hours: user.drip_delay_hours || 18,
          },
        });
      }
    } catch (err) {
      log.warn("[webhook] drip enqueue failed:", err?.message);
    }
  }

  // do_not_send → pause the conversation, exit cleanly. Mirrors the
  // human_in_loop pause pattern but with a distinct reason code so the
  // dashboard can render a different reason chip.
  if (
    dmIntent?.class === "do_not_send" &&
    dmIntent.confidence >= DO_NOT_SEND_PAUSE_THRESHOLD
  ) {
    // Derive the pause reason from the classifier's signals instead of
    // hardcoding 'hostile_or_refund'. A script-echo / probe flag is not
    // hostility, and labeling it as such made paused threads undebuggable.
    const pauseReason = pauseReasonForDoNotSend(dmIntent.signals);
    await supabase
      .from("conversations")
      .update({
        ai_paused: true,
        ai_pause_reason: pauseReason,
      })
      .eq("id", conversation.id);
    await logVoiceSend({
      userId: user.id,
      voiceSnippetId: null,
      conversationId: conversation.id,
      recipientPsid: senderId,
      intentClass: dmIntent.class,
      status: "skipped_do_not_send",
    });
    getPostHogClient().capture({
      distinctId: user.email || user.id,
      event: "dm_paused_do_not_send",
      properties: {
        conversation_id: conversation.id,
        pause_reason: pauseReason,
        signals: dmIntent.signals,
        reasoning: dmIntent.reasoning,
      },
    });
    return;
  }

  // If the conversation was started by a cold DM the coach sent natively but
  // we never saw the outbound text, fetch the active creator_offers row so the
  // prompt builder can ground the reply in the offer instead of falling back
  // to a generic inbound greeting.
  let activeOffer = null;
  if (
    conversation.origin === "clinchd_sent" &&
    conversation.missing_outbound_context === true
  ) {
    const { data: offerRow } = await supabase
      .from("creator_offers")
      .select("offer_name, ideal_customer, objections")
      .eq("creator_id", user.id)
      .is("deprecated_at", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    activeOffer = offerRow || null;
  }

  // Build prompt and generate reply
  const systemPrompt = buildSystemPrompt(sc, user.calendly_url, {
    voiceProfile: user.voice_profile,
    conversation,
    activeOffer,
  });

  // ── Voice routing ──────────────────────────────────────────────────
  // When the DM intent classifier returned a confident class AND the coach
  // has an active voice snippet for that class, send the audio and exit
  // before generateReply. Falls through to the text path on ANY failure
  // (rate limit, signed-URL error, Meta send error) so the lead is never
  // ghosted by a misfiring voice path.
  if (dmIntent && dmIntent.confidence >= VOICE_ROUTING_THRESHOLD) {
    const { snippet: voiceSnippet, reason: voiceSkipReason } =
      await findVoiceSnippetForIntent(user.id, dmIntent.class);

    if (!voiceSnippet && voiceSkipReason === "kill_switch") {
      // Observable signal for the Meta App Review window — confirms the
      // kill switch is actively blocking sends on the reviewer account.
      // 'no_snippet' and 'lookup_error' are intentionally NOT logged here
      // (the former is noisy on every uncovered class; the latter already
      // warns to console inside the matcher).
      await logVoiceSend({
        userId: user.id,
        voiceSnippetId: null,
        conversationId: conversation.id,
        recipientPsid: senderId,
        intentClass: dmIntent.class,
        status: "skipped_kill_switch",
      });
    }

    if (voiceSnippet) {
      // Voice replies count toward Meta's 200/hr outbound DM cap. Reserve
      // the slot first so we don't double-send if generateReply fires later.
      let canSendVoice = true;
      try {
        const { data: allowed, error: rlErr } = await supabase.rpc(
          "check_and_record_outbound",
          { uid: user.id }
        );
        if (rlErr) {
          log.warn("[webhook] voice outbound rate-limit RPC failed:", rlErr.message);
        } else if (allowed === false) {
          canSendVoice = false;
          await logVoiceSend({
            userId: user.id,
            voiceSnippetId: voiceSnippet.id,
            conversationId: conversation.id,
            recipientPsid: senderId,
            intentClass: dmIntent.class,
            status: "fallback_text",
            errorMessage: "rate_limited",
          });
        }
      } catch (err) {
        log.warn("[webhook] voice outbound rate-limit threw:", err?.message);
      }

      if (canSendVoice) {
        try {
          const audioUrl = await getSendableAudioUrl(voiceSnippet.storage_path);
          const voiceSendResult = await sendVoiceMessage({
            igUserId: user.instagram_business_account_id,
            encryptedAccessToken: user.meta_page_access_token,
            recipientPsid: senderId,
            audioUrl,
          });

          await supabase
            .from("messages")
            .insert({
              conversation_id: conversation.id,
              role: "assistant",
              content: `[voice reply: ${voiceSnippet.label}]`,
              source: "agent",
              // Meta mid so the echo of this send dedups in handleEchoEvent
              provider_message_id: voiceSendResult?.message_id || null,
            });

          await supabase
            .from("conversations")
            .update({
              last_message_at: new Date().toISOString(),
              last_skip_reason: null,
            })
            .eq("id", conversation.id);

          await logVoiceSend({
            userId: user.id,
            voiceSnippetId: voiceSnippet.id,
            conversationId: conversation.id,
            recipientPsid: senderId,
            intentClass: dmIntent.class,
            status: "sent",
          });

          getPostHogClient().capture({
            distinctId: user.email || user.id,
            event: "ai_reply_sent",
            properties: {
              conversation_id: conversation.id,
              reply_mode: "voice",
              intent_class: dmIntent.class,
              snippet_id: voiceSnippet.id,
            },
          });

          // Insertion C — schedule a follow-up nudge after the voice reply.
          // The voice path returns before status detection, so use the
          // conversation's current status.
          await maybeEnqueueDrip(conversation.status);

          return;
        } catch (err) {
          log.error("[webhook] voice send failed, falling back to text:", err?.message);
          await logVoiceSend({
            userId: user.id,
            voiceSnippetId: voiceSnippet.id,
            conversationId: conversation.id,
            recipientPsid: senderId,
            intentClass: dmIntent.class,
            status: "fallback_text",
            errorMessage: err?.message || "voice_send_failed",
          });
        }
      }
    }
  }

  let aiReply;
  try {
    aiReply = await generateReply(systemPrompt, messages);
  } catch (err) {
    console.error("generateReply failed for conversation:", conversation.id, err.message);
    getPostHogClient().capture({
      distinctId: user.email || user.id,
      event: "ai_reply_failed",
      properties: { conversation_id: conversation.id, error: err.message },
    });
    return;
  }

  // Save AI reply. The insert stays BEFORE the send (a rate-limited or failed
  // send must still leave the reply in the DB); the Meta mid is stamped onto
  // this row after a successful send so its echo dedups in handleEchoEvent.
  const { data: savedReply, error: aiInsertError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversation.id,
      role: "assistant",
      content: aiReply,
      source: "agent",
    })
    .select("id")
    .single();
  if (aiInsertError) log.error("[webhook] AI reply insert failed:", aiInsertError.code);
  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString(), last_skip_reason: null })
    .eq("id", conversation.id);

  // Check Meta's 200/hr outbound DM cap before sending. If we're over, the
  // reply stays saved to DB (the owner can send it manually from the dashboard)
  // but we skip the API call so we don't burn the rate limit.
  let canSend = true;
  try {
    const { data: allowed, error: rlErr } = await supabase.rpc(
      "check_and_record_outbound",
      { uid: user.id }
    );
    if (rlErr) {
      console.error("outbound rate-limit RPC failed:", rlErr);
    } else if (allowed === false) {
      canSend = false;
      console.warn("[webhook] outbound rate-limit hit for user:", user.id);
      getPostHogClient().capture({
        distinctId: user.email || user.id,
        event: "ai_reply_rate_limited",
        properties: { conversation_id: conversation.id },
      });
    }
  } catch (err) {
    console.error("outbound rate-limit threw:", err?.message);
  }

  if (canSend) {
    // Send reply via Meta Instagram API
    try {
      const sendResult = await sendInstagramMessage(
        user.instagram_business_account_id,
        senderId,
        aiReply,
        decryptToken(user.meta_page_access_token)
      );
      // Stamp the Meta mid so the echo of this send dedups. If the echo
      // webhook won the race, handleEchoEvent already stamped this same mid
      // on this row (twin reconciliation) and this update is a no-op.
      if (savedReply?.id && sendResult?.message_id) {
        const { error: midError } = await supabase
          .from("messages")
          .update({ provider_message_id: sendResult.message_id })
          .eq("id", savedReply.id);
        if (midError) log.warn("[webhook] mid stamp failed:", midError.code);
      }
      getPostHogClient().capture({
        distinctId: user.email || user.id,
        event: "ai_reply_sent",
        properties: { conversation_id: conversation.id, reply_length: aiReply.length },
      });
    } catch (err) {
      console.error("sendInstagramMessage failed for conversation:", conversation.id, err.message);
      getPostHogClient().capture({
        distinctId: user.email || user.id,
        event: "message_delivery_failed",
        properties: { conversation_id: conversation.id, error: err.message },
      });
      // Reply is saved to DB but wasn't delivered — continue to status detection
    }
  }

  // Status detection — check both AI reply and lead's message
  const statusOrder = ["qualifying", "interested", "booked"];
  const currentIdx = statusOrder.indexOf(conversation.status);
  let newStatus = conversation.status;

  // Detect from AI reply
  const hasCalendlyLink = user.calendly_url && aiReply.includes(user.calendly_url);
  const hasBookKeyword =
    /\b(book a call|schedule a call|book a slot|grab a spot|set up a time|appointment)\b/i.test(aiReply);
  const hasBookedFromAi =
    hasCalendlyLink &&
    /\b(confirmed|booked|see you (on|soon|then)|looking forward to (the call|our call|chatting|speaking))\b/i.test(aiReply);
  const hasNotAFitKeyword =
    /\b(not (the right|a good|a great) fit|not quite what|might not be (for you|the best))\b/i.test(aiReply);

  // Detect from lead's message — if they say they booked, mark as booked
  const leadBookedKeyword =
    /\b(i booked|just booked|booked a (slot|time|call|spot)|i('ve| have) (booked|scheduled)|signed up|registered|see you (on|at)|looking forward to (the|our) (call|chat|meeting))\b/i.test(messageText);

  if ((hasCalendlyLink || hasBookKeyword) && statusOrder.indexOf("interested") > currentIdx) {
    newStatus = "interested";
  }
  if ((hasBookedFromAi || leadBookedKeyword) && statusOrder.indexOf("booked") > currentIdx) {
    newStatus = "booked";
  }
  if (hasNotAFitKeyword && conversation.status !== "booked") {
    newStatus = "not_a_fit";
  }

  if (newStatus !== conversation.status) {
    await supabase.from("conversations").update({ status: newStatus }).eq("id", conversation.id);
    getPostHogClient().capture({
      distinctId: user.email || user.id,
      event: "lead_status_changed",
      properties: {
        conversation_id: conversation.id,
        from_status: conversation.status,
        to_status: newStatus,
        source: "ai_detection",
      },
    });

    // Fire-and-forget notification alerts
    if (newStatus === "interested") {
      sendHotLeadAlert(user, conversation).catch(console.error);
    }
    if (newStatus === "booked") {
      sendBookingAlert(user, conversation).catch(console.error);
    }
  }

  // Insertion C — schedule a follow-up nudge after the text reply. Use the
  // resolved status so a reply that just moved the lead to booked/not_a_fit
  // never schedules a nudge.
  await maybeEnqueueDrip(newStatus);
}
