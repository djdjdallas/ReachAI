import { NextResponse, after } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { generateReply, classifyIncomingMessage } from "@/lib/anthropic";
import { buildSystemPrompt } from "@/lib/prompts";
import {
  sendInstagramMessage,
  sendSenderAction,
  verifyWebhookSignature,
  getParticipantProfile,
} from "@/lib/instagram";
import { decryptToken } from "@/lib/token-utils";
import { isMetaTokenRevoked, flagMetaReconnect } from "@/lib/tokens/reconnect";
import { sendHotLeadAlert, sendBookingAlert } from "@/lib/notifications";
import { sendHandoffEmail } from "@/lib/alerts/handoff-email";
import { getPostHogClient } from "@/lib/posthog-server";
import { log } from "@/lib/logger";
import { handleCommentEvent } from "@/lib/webhooks/comment-event";
import {
  classifyDMIntent,
  DM_INTENT_VERSION,
  VOICE_ROUTING_THRESHOLD,
  withTimeout,
} from "@/lib/dm-intent";
import { statusForIntent } from "@/lib/intent-status";
import { decideIntentGate } from "@/lib/dm-intent-gate";
import { getActiveOffer, ownerFromUser } from "@/lib/active-offer";
import { lintReply } from "@/lib/reply-lint";
import { findVoiceSnippetForIntent, getSendableAudioUrl } from "@/lib/voice/matcher";
import { sendVoiceMessage, logVoiceSend } from "@/lib/voice/sender";
import { inactiveGate, inactiveSentinelReason } from "@/lib/inactive-inbound";

// Hard wall-clock budget for the whole inbound chain. The 20s delay cap
// (+15% jitter ≈ 23s) plus the 30s-capped model calls and the Meta send must
// finish inside this, or the platform default kills the function mid-chain
// and Meta's redelivery hits the message dedupe — the lead is then ghosted
// (see docs/reply-latency-audit-2026-07-25.md, HIGH finding 2).
export const maxDuration = 60;

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

      // Anchor for the total-latency floor: the response_delay target is
      // measured from here (webhook receipt of this event), so processing
      // time counts against the configured delay instead of adding to it.
      const receivedAtMs = Date.now();

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
            .select("id, meta_page_access_token, meta_reconnect_required")
            .eq("instagram_business_account_id", igAccountId)
            .maybeSingle();
        if (ownerLookupError) {
          log.error(
            `[resolver:inbound-name] lookup ERROR for igba=${igAccountId}: ${ownerLookupError.code} ${ownerLookupError.message}`
          );
        }

        let senderName = null;
        let senderUsername = null;
        // Skip the lookup entirely on a known-dead token: it would fail the
        // same way on every inbound DM. processIncomingMessage still saves
        // the message and records the skip.
        if (ownerUser?.meta_page_access_token && !ownerUser.meta_reconnect_required) {
          try {
            const pageToken = decryptToken(ownerUser.meta_page_access_token);
            const profile = await getParticipantProfile(senderId, pageToken);
            senderName = profile?.name || profile?.username || null;
            senderUsername = profile?.username || null;
          } catch (profileErr) {
            // getParticipantProfile only throws on OAuth code 190. Flag the
            // account only on the strict dead-token rule (first failure emails
            // the coach) and carry on nameless either way so the inbound
            // message is still persisted below.
            if (isMetaTokenRevoked(profileErr)) {
              await flagMetaReconnect(supabaseForName, ownerUser.id, profileErr, "webhook:profile");
            } else {
              log.warn("[webhook] profile lookup failed:", profileErr?.message);
            }
          }
        }

        await processIncomingMessage({
          lookupField: "instagram_business_account_id",
          lookupValue: igAccountId,
          senderId,
          messageText,
          senderName,
          senderUsername,
          providerMessageId: event.message?.mid || null,
          receivedAtMs,
        });
      } catch (err) {
        console.error("Error processing Meta message:", err);
      }
    }
  }

  return NextResponse.json({ status: "ok" }, { status: 200 });
}

// ── Helpers ─────────────────────────────────────────────────────────────

// Fire-and-forget sender action (mark_seen / typing_on / typing_off). An
// indicator failure must never block or fail the reply path, so this never
// awaits the network call and swallows every error after a warn.
function fireSenderAction(user, recipientId, action) {
  try {
    if (!user?.meta_page_access_token || !user?.instagram_business_account_id) return;
    const pageToken = decryptToken(user.meta_page_access_token);
    sendSenderAction(
      user.instagram_business_account_id,
      recipientId,
      action,
      pageToken
    ).catch((err) =>
      log.warn(`[webhook] sender_action ${action} failed:`, err?.message)
    );
  } catch (err) {
    log.warn(`[webhook] sender_action ${action} failed:`, err?.message);
  }
}

// ── Skip-reason vocabulary ──────────────────────────────────────────────
// Short, stable snake_case tokens so suppressions can be grouped in SQL
// (`select last_skip_reason, count(*) ... group by 1`). Never prose — a
// free-text reason is unqueryable, which is how we ended up unable to answer
// "why didn't the AI reply here?" from data at all.
//
// CLASSIFIER_TIMEOUT and NO_REPLY_NEEDED are declared but not currently
// reachable: the classifiers fail OPEN (route replies anyway, see
// docs/audit-2026-08-15-reply-path.md Q4) and there is no "nothing to say"
// branch. Both are recorded in messages.intent_classification instead. They
// are listed here so the vocabulary is complete if that ever changes —
// deliberately NOT wired up, because changing fail-open semantics was
// explicitly out of scope for this change.
const SKIP = {
  AI_INACTIVE: "ai_inactive",
  AI_PAUSED: "ai_paused",
  HUMAN_TAKEOVER: "human_takeover",
  DO_NOT_SEND: "do_not_send",
  // do_not_send below the pause threshold: this turn gets no reply, but the
  // thread is not paused.
  DO_NOT_SEND_HELD: "do_not_send_held",
  // Classifier says personal / off-topic (not_a_lead): no reply, no pause.
  NOT_A_LEAD: "not_a_lead",
  // The generated reply still contained a {{placeholder}} after the
  // pre-send filter, so it was not sent.
  REPLY_BLOCKED: "reply_blocked",
  // Human-in-loop escalation paused the thread for the owner.
  ESCALATED: "escalated",
  CLASSIFIER_TIMEOUT: "classifier_timeout",
  NO_REPLY_NEEDED: "no_reply_needed",
  RATE_LIMITED: "rate_limited",
  DUPLICATE_MESSAGE: "duplicate_message",
  // The COACH has no opening line saved (script_config.greeting) — says
  // nothing about the lead's message. Renamed from 'no_greeting', which
  // read as "the lead didn't say hello" and misled two readers in one day;
  // migration 20260908120000 backfilled existing rows.
  GREETING_NOT_CONFIGURED: "greeting_not_configured",
  DM_LIMIT: "dm_limit",
  HISTORY_FETCH_FAILED: "history_fetch_failed",
  GENERATION_FAILED: "generation_failed",
  SEND_FAILED: "send_failed",
  RECONNECT_REQUIRED: "reconnect_required",
};

// Mark a conversation's `last_skip_reason` so the dashboard can explain why
// the agent didn't reply on a given turn. Cleared by the success path.
async function markSkip(supabase, conversation_id, reason) {
  const { error } = await supabase
    .from("conversations")
    .update({ last_skip_reason: reason })
    .eq("id", conversation_id);
  if (error) log.error("[webhook] markSkip failed:", error.code);
}

// Persist the classifier outcome onto the INBOUND lead message row.
//
// A NULL intent_classification is indistinguishable from "the classifier never
// ran", which made every reply decision unauditable after the fact. So every
// inbound message that reaches this pipeline gets a row here — a real
// classification when we have one, a sentinel when we don't.
//
// Targets by message id rather than provider_message_id: the previous write
// keyed on the Meta mid, so any inbound without one silently persisted
// nothing.
//
// Returns a promise that NEVER rejects — every failure is caught and logged,
// so `await`ing this can't break a reply. Callers on a branch that returns
// straight afterwards MUST await it: this runs on serverless, and a
// floating promise fired immediately before `return` can be frozen before the
// write lands, which would silently reintroduce the NULLs this exists to
// eliminate.
function recordClassification(supabase, messageId, payload) {
  if (!messageId || !payload) return Promise.resolve();
  return Promise.resolve(
    supabase
      .from("messages")
      .update({ intent_classification: payload })
      .eq("id", messageId)
  )
    .then(({ error }) => {
      if (error) log.warn("[webhook] intent_classification write failed:", error.code);
    })
    .catch((err) =>
      log.warn("[webhook] intent_classification write threw:", err?.message)
    );
}

// Sentinel written when the classifier does not return a usable result.
// `failed_open: true` records that we replied anyway despite having no
// classification — the pipeline's existing behaviour, preserved as-is here and
// merely made visible.
function classificationSentinel(status, reason, failedOpen) {
  return {
    status,
    reason,
    failed_open: failedOpen,
    at: new Date().toISOString(),
  };
}

// ── Human takeover ──────────────────────────────────────────────────────
// When a human types in a thread, the AI stops until a human explicitly
// resumes it from the dashboard. There is no time-based auto-resume: a
// surprise resume is the same bug with a delay.
//
// Guarded on `ai_paused = false`, which does the whole job in one statement:
//   - unpaused thread  -> pauses it, stamps 'human_took_over'
//   - already paused   -> matches 0 rows, so a stronger existing reason
//                         (flagged_do_not_send, hostile_or_refund,
//                         complex_objection, qualifying_loop_detected) is
//                         never downgraded
//   - already paused for human_took_over -> 0 rows, already correct
//
// Only ever called for source='manual'. NEVER call this for 'agent' or 'drip'
// — those are the AI's own messages and pausing on them would disable the
// product on the first reply.
async function pauseForHumanTakeover(supabase, conversation_id) {
  const { data, error } = await supabase
    .from("conversations")
    .update({ ai_paused: true, ai_pause_reason: "human_took_over" })
    .eq("id", conversation_id)
    .eq("ai_paused", false)
    .select("id");
  if (error) {
    log.error("[webhook] human-takeover pause failed:", error.code);
    return false;
  }
  if (data?.length) {
    log.info("[webhook] AI paused — human took over conversation:", conversation_id);
    return true;
  }
  return false;
}

// Human-in-loop escalation check. Never throws: resolves to an outcome object
// that is persisted on the inbound row's intent_classification.escalation and
// passed to decideIntentGate. A timeout or error resolves to failed_open, so
// the turn proceeds as if no escalation was needed (the existing behavior,
// now recorded).
async function checkEscalation(messageText, messages, sc) {
  try {
    const r = await withTimeout(
      classifyIncomingMessage(messageText, messages, sc),
      8000,
      "classifyIncomingMessage"
    );
    return {
      status: "ok",
      needs_human: r.needs_human === true,
      category: r.category || "none",
      reason: r.reason || "",
    };
  } catch (err) {
    // withTimeout REJECTS on timeout, so a timeout and an API error both land
    // here and are told apart by the message shape.
    const timedOut = /timed out after/i.test(err?.message || "");
    log.warn("[webhook] escalation check failed, falling through:", err?.message);
    return {
      status: timedOut ? "timeout" : "error",
      reason: timedOut
        ? "classifier exceeded 8000ms"
        : err?.message || "classifyIncomingMessage failed",
      failed_open: true,
    };
  }
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

    const { data: conv, error: echoConvLookupError } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_id", user.id)
      .eq("instagram_sender_id", recipientId)
      .maybeSingle();
    if (echoConvLookupError) {
      // Never treat a failed lookup as "no conversation" — that path mints
      // duplicate threads. Drop this echo instead.
      log.error("[webhook] echo conversation lookup failed:", echoConvLookupError.code);
      return;
    }
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
          if (isMetaTokenRevoked(err)) {
            await flagMetaReconnect(supabase, user.id, err, "webhook:echo-profile");
          } else {
            log.warn("[webhook] echo profile lookup failed:", err?.message);
          }
        }
      }

      const { data: newConv, error: createError } = await supabase
        .from("conversations")
        .insert({
          user_id: user.id,
          instagram_sender_id: recipientId,
          instagram_thread_id: recipientId,
          status: "new",
          ai_paused: false,
          sender_name: senderName,
          // Born from a manually-sent DM — same semantics as the Native Send
          // pre-log path, so NATIVE_SEND_PREFIX fires when the prospect
          // replies (src/lib/prompts.js).
          origin: "native_send",
        })
        .select()
        .single();
      if (createError?.code === "23505") {
        // conversations_user_sender_unique: the inbound path (or another echo)
        // created the row between our select and insert. Re-select and treat
        // as an existing conversation.
        const { data: raced, error: racedError } = await supabase
          .from("conversations")
          .select("id")
          .eq("user_id", user.id)
          .eq("instagram_sender_id", recipientId)
          .maybeSingle();
        if (racedError || !raced) {
          log.error("[webhook] echo conversation race re-select failed:", racedError?.code);
          return;
        }
        conversation = raced;
      } else if (createError) {
        log.error("[webhook] echo create conversation failed:", createError.code);
        return;
      } else {
        getPostHogClient().capture({
          distinctId: user.id,
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
    // source='manual' is what marks this as HUMAN-typed rather than
    // AI-generated — the two are indistinguishable by `role` alone.
    const echoInsert = await insertMessageIfNew(supabase, {
      conversation_id: conversation.id,
      role: "assistant",
      content: messageText,
      provider_message_id: mid,
      source: "manual",
    });

    // Human takeover. This is the path that matters: the coach types most
    // replies in the native Instagram app, and Meta delivers those to us as
    // echoes. Before this, a manual reply left ai_paused untouched and the AI
    // would talk over the coach on the lead's next message — 17 hours later,
    // in the 2026-08-10 incident.
    //
    // Only on a genuine insert. A duplicate means we already saw this mid, and
    // the twin-stamp branch above returns before reaching here, so an
    // API-sent reply echoing back can never trip this.
    //
    // A manual echo is a takeover only if the lead has spoken. Outbound-first
    // openers (including multi-message openers sent before any reply) are the
    // Native Send motion — the coach opens, the AI answers the lead's reply.
    // Pausing on the opener made every outbound-first thread born paused and
    // the AI never engaged (regression in 6d536d8).
    if (!echoInsert.duplicate && !echoInsert.error) {
      let leadHasSpoken = false;
      if (!conversationWasJustCreated) {
        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", conversation.id)
          .eq("role", "user");
        leadHasSpoken = (count || 0) > 0;
      }
      if (leadHasSpoken) {
        await pauseForHumanTakeover(supabase, conversation.id);
      }
    }
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
        distinctId: userId,
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
      distinctId: userId,
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
  receivedAtMs = Date.now(),
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

  // ── Subscription gate ───────────────────────────────────────────────
  // Non-serving accounts (trial expired, canceled) get NO reply, but the
  // lead's message is still saved below, right after the conversation is
  // resolved, so the coach sees it and the dashboard can count missed
  // leads. It used to return here, before the save, dropping every inbound
  // DM. past_due is served (grace window while Stripe retries the card;
  // access truly ends at customer.subscription.deleted → 'canceled').
  const inactive = inactiveGate(user);
  if (inactive?.flipToExpired) {
    // First turn after the trial lapsed: flip the row so the
    // TrialExpiredGate modal and /api/ai/reply agree.
    await supabase
      .from("users")
      .update({ subscription_status: "expired", ai_mode: "off" })
      .eq("id", user.id);
  }

  // Lazy-reset monthly DM count
  const now = new Date();
  const resetAt = user.dm_count_reset_at ? new Date(user.dm_count_reset_at) : null;
  if (
    !inactive &&
    (!resetAt ||
      now.getMonth() !== resetAt.getMonth() ||
      now.getFullYear() !== resetAt.getFullYear())
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

  const { data: conv, error: convLookupError } = await supabase
    .from("conversations")
    .select("*")
    .eq("user_id", user.id)
    .eq("instagram_sender_id", senderId)
    .maybeSingle();
  if (convLookupError) {
    // Abort rather than fall through to insert: treating a failed lookup as
    // "no conversation" is what turned transient errors into duplicate
    // threads that re-greeted the lead on every message.
    log.error("[webhook] conversation lookup failed:", convLookupError.code);
    return;
  }
  conversation = conv;

  if (!conversation) {
    const { data: newConv, error: createError } = await supabase
      .from("conversations")
      .insert({
        user_id: user.id,
        instagram_sender_id: senderId,
        instagram_thread_id: senderId,
        status: "new",
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

    if (createError?.code === "23505") {
      // conversations_user_sender_unique: a concurrent invocation (double-text
      // or racing echo) created the row between our select and insert.
      // Re-select and continue on the winner's row.
      const { data: raced, error: racedError } = await supabase
        .from("conversations")
        .select("*")
        .eq("user_id", user.id)
        .eq("instagram_sender_id", senderId)
        .maybeSingle();
      if (racedError || !raced) {
        log.error("[webhook] conversation race re-select failed:", racedError?.code);
        return;
      }
      conversation = raced;
    } else if (createError) {
      log.error("[webhook] create conversation failed:", createError.code);
      return;
    } else {
      getPostHogClient().capture({
        distinctId: user.id,
        event: "conversation_created",
        properties: { conversation_id: newConv.id, sender_name: senderName },
      });
      conversation = newConv;
      conversationWasJustCreated = true;
    }
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

  // ── Non-serving account: save the inbound, nothing else ─────────────
  // Runs BEFORE the ai_mode gate: expiry and cancellation also set
  // ai_mode='off', whose contract is "save nothing", and that would drop
  // the lead again. Everything below this point (DM metering, drip cancel,
  // history, classifiers, model calls, typing indicators, voice, sends) is
  // unreachable for these accounts.
  if (inactive) {
    const inactiveInsert = await insertMessageIfNew(supabase, {
      conversation_id: conversation.id,
      role: "user",
      content: messageText,
      provider_message_id: providerMessageId,
      source: "lead",
    });
    await markSkip(supabase, conversation.id, inactive.reason);
    await recordClassification(
      supabase,
      inactiveInsert.data?.id,
      classificationSentinel("skipped", inactiveSentinelReason(inactive.reason), false)
    );
    return;
  }

  // ── Global AI mode gate ─────────────────────────────────────────────
  // 'off'     → complete silence: return without saving anything
  // 'handoff' → save inbound message for dashboard, but skip AI reply
  // 'active'  → full processing (may still be paused per-conversation)
  if (user.ai_mode === "off") {
    // Still records WHY. 'off' saves no message, but the conversation row is
    // the only place a suppressed turn can leave a trace.
    await markSkip(supabase, conversation.id, SKIP.AI_INACTIVE);
    return;
  }

  // ── Dead-token gate ─────────────────────────────────────────────────
  // The coach's Instagram connection needs a reconnect (set by the refresh
  // cron or by a live Graph failure above). Runs after the ai_mode 'off'
  // gate so 'off' keeps its complete-silence contract. Every Meta call below
  // would be rejected, so save the inbound message for the dashboard, record why the
  // reply was skipped, and stop before spending typing indicators, a model
  // call, and a doomed send on it.
  if (user.meta_reconnect_required) {
    await insertMessageIfNew(supabase, {
      conversation_id: conversation.id,
      role: "user",
      content: messageText,
      provider_message_id: providerMessageId,
      source: "lead",
    });
    await markSkip(supabase, conversation.id, SKIP.RECONNECT_REQUIRED);
    log.warn(`[webhook] skip reconnect_required user=${user.id} conversation=${conversation.id}`);
    return;
  }

  // Per-thread gates get the handoff treatment (save the inbound message,
  // skip the AI reply): ai_paused, and status='manual' — the "Human
  // Takeover" dropdown, which previously changed the badge without
  // stopping AI replies. Gated set is 'manual' only: 'human_takeover' is
  // a badge-only legacy alias (no writer, not allowed by the status CHECK)
  // and 'not_a_fit' deliberately does NOT gate — a cold label must not
  // silently stop replies unless the founder chooses takeover.
  if (
    user.ai_mode === "handoff" ||
    conversation.ai_paused ||
    conversation.status === "manual"
  ) {
    const gatedInsert = await insertMessageIfNew(supabase, {
      conversation_id: conversation.id,
      role: "user",
      content: messageText,
      provider_message_id: providerMessageId,
      source: "lead",
    });

    // Name the specific gate rather than a generic "skipped". These three
    // suppress for very different reasons and the dashboard needs to tell
    // them apart.
    const gateReason = conversation.ai_paused
      ? SKIP.AI_PAUSED
      : conversation.status === "manual"
        ? SKIP.HUMAN_TAKEOVER
        : SKIP.AI_INACTIVE;
    await markSkip(supabase, conversation.id, gateReason);

    // This gate returns before the classifier runs, which is why paused and
    // manual threads had ~0% intent_classification coverage while active ones
    // sat near 85% (see docs/audit-2026-08-15-reply-path.md Q7). Record a
    // 'skipped' sentinel so the NULL no longer means "unknown".
    await recordClassification(
      supabase,
      gatedInsert.data?.id,
      classificationSentinel("skipped", `gated before classification: ${gateReason}`, false)
    );
    return;
  }

  // Skip if no script configured
  const sc = user.script_config || {};
  if (!sc.greeting) {
    const noScriptInsert = await insertMessageIfNew(supabase, {
      conversation_id: conversation.id,
      role: "user",
      content: messageText,
      provider_message_id: providerMessageId,
      source: "lead",
    });
    await markSkip(supabase, conversation.id, SKIP.GREETING_NOT_CONFIGURED);
    await recordClassification(
      supabase,
      noScriptInsert.data?.id,
      classificationSentinel("skipped", "gated before classification: greeting_not_configured", false)
    );
    return;
  }

  // Save incoming message (with deduplication) BEFORE any metering, so a
  // Meta redelivery can neither burn quota nor overwrite last_skip_reason on
  // a turn that was actually delivered.
  const insertResult = await insertMessageIfNew(supabase, {
    conversation_id: conversation.id,
    role: "user",
    content: messageText,
    provider_message_id: providerMessageId,
    source: "lead",
  });
  if (insertResult.duplicate) {
    return;
  }

  // DM cap — meters CONVERSATIONS, not messages. The plan sells "1,500
  // qualified conversations per month"; incrementing per message burned a
  // normal 20-message thread's worth of slots on one real conversation. A
  // conversation counts once per calendar month (conversations.dm_counted_at).
  const dmLimit = user.plan === "unlimited" ? Infinity : 1500;
  if (dmLimit !== Infinity) {
    const countedAt = conversation.dm_counted_at
      ? new Date(conversation.dm_counted_at)
      : null;
    const alreadyCountedThisMonth =
      countedAt &&
      countedAt.getMonth() === now.getMonth() &&
      countedAt.getFullYear() === now.getFullYear();
    if (!alreadyCountedThisMonth) {
      const { data: newCount, error: rpcError } = await supabase.rpc("increment_dm_count", { uid: user.id });
      if (rpcError) {
        log.error("increment_dm_count failed:", rpcError.code);
        return;
      }
      if (newCount > dmLimit) {
        await markSkip(supabase, conversation.id, SKIP.DM_LIMIT);
        await recordClassification(
          supabase,
          insertResult.data?.id,
          classificationSentinel("skipped", "gated before classification: dm_limit", false)
        );
        return;
      }
      await supabase
        .from("conversations")
        .update({ dm_counted_at: now.toISOString() })
        .eq("id", conversation.id);
      conversation.dm_counted_at = now.toISOString();
    }
  }

  // Id of the INBOUND lead row. Every classifier outcome below is written
  // here, by id — the previous write keyed on the Meta mid, so any inbound
  // without one persisted nothing at all.
  const inboundMessageId = insertResult.data?.id || null;

  // Typing indicator: the lead sees "seen" then "typing…" while the models
  // run, instead of a silent gap followed by a full paragraph. Fires only
  // past every receipt-time gate above (echoes, inactive subscription,
  // pause/handoff, no-script, DM limit, duplicate), so skipped paths never
  // flash an indicator. Fire-and-forget — never blocks the reply. Paths
  // below that bail without sending are responsible for typing_off.
  fireSenderAction(user, senderId, "mark_seen");
  fireSenderAction(user, senderId, "typing_on");

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
        distinctId: user.id,
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
    distinctId: user.id,
    event: "message_received",
    properties: { conversation_id: conversation.id, message_length: messageText.length },
  });

  // Total-latency floor (replaces the old fixed 1–3s pre-generation sleep).
  // Target = users.response_delay clamped to 3–20s with ±15% jitter, measured
  // from webhook receipt — a configured 15s means the lead sees the reply
  // ~15s after sending, not 15s + processing. The wait runs just before the
  // send (after reply generation), sleeps only the remainder, then re-checks
  // the pause gates: a coach who pauses or takes over during the delay
  // window must win over an in-flight reply. Recheck fails OPEN on query
  // errors — the receipt-time gates already passed, and a transient DB blip
  // must not ghost the lead.
  const delaySeconds = Math.min(Math.max(Number(user.response_delay) || 3, 3), 20);
  const targetDelayMs = delaySeconds * 1000 * (0.85 + Math.random() * 0.3);
  async function waitDelayFloorAndRecheckGates() {
    const remainderMs = Math.max(0, targetDelayMs - (Date.now() - receivedAtMs));
    if (remainderMs > 0) {
      await new Promise((r) => setTimeout(r, remainderMs));
    }
    try {
      const [convRes, userRes] = await Promise.all([
        supabase
          .from("conversations")
          .select("ai_paused, status")
          .eq("id", conversation.id)
          .maybeSingle(),
        supabase
          .from("users")
          .select("ai_mode")
          .eq("id", user.id)
          .maybeSingle(),
      ]);
      if (convRes.error || userRes.error) {
        log.warn(
          "[webhook] post-delay gate recheck failed, proceeding:",
          convRes.error?.code || userRes.error?.code
        );
        return { blocked: false };
      }
      // Mirror the receipt-time gate set exactly (ai_mode off/handoff,
      // ai_paused, status='manual') — see the per-thread gates above.
      if (userRes.data?.ai_mode === "off") {
        return { blocked: true, reason: "ai_mode_off_during_delay" };
      }
      if (userRes.data?.ai_mode === "handoff") {
        return { blocked: true, reason: "handoff_during_delay" };
      }
      if (convRes.data?.ai_paused) {
        return { blocked: true, reason: "paused_during_delay" };
      }
      if (convRes.data?.status === "manual") {
        return { blocked: true, reason: "manual_takeover_during_delay" };
      }
      return { blocked: false };
    } catch (err) {
      log.warn("[webhook] post-delay gate recheck threw, proceeding:", err?.message);
      return { blocked: false };
    }
  }

  // Fetch conversation history — newest 20 rows, restored to chronological
  // order. Ascending+limit returned the OLDEST 20, so threads longer than 20
  // messages dropped the newest inbound from context (and violated
  // detectQualifyingLoop's contract that the latest inbound is included).
  //
  // `source` is selected alongside role/content and is NOT optional. role
  // tells you which side of the thread a message is on; source is the only
  // field that says whether a human or the AI produced it. Dropping it here is
  // what let the model read the coach's own manual message as something the
  // lead had said (see docs/audit-2026-08-15-reply-path.md, root cause).
  const { data: messagesDesc, error: msgError } = await supabase
    .from("messages")
    .select("role, content, source")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (msgError) {
    // No reply will be sent this turn — clear the typing indicator.
    fireSenderAction(user, senderId, "typing_off");
    log.error("fetch messages failed:", msgError.code);
    await markSkip(supabase, conversation.id, SKIP.HISTORY_FETCH_FAILED);
    await recordClassification(
      supabase,
      inboundMessageId,
      classificationSentinel("skipped", "history fetch failed before classification", false)
    );
    return;
  }

  const messages = (messagesDesc || []).reverse();

  // Qualifying-loop guard. If the agent has already asked the same kind of
  // qualifying question 3 turns in a row and the lead has never given a
  // substantive answer, pause the conversation rather than fire a 4th attempt.
  if (detectQualifyingLoop(messages)) {
    // No reply will be sent this turn — clear the typing indicator.
    fireSenderAction(user, senderId, "typing_off");
    // Guarded to ai_paused=false so only the actual false→true transition
    // fires the owner's handoff email — a retried delivery finds the thread
    // already paused, updates zero rows, and stays silent.
    const { data: pausedRows } = await supabase
      .from("conversations")
      .update({
        ai_paused: true,
        ai_pause_reason: "qualifying_loop_detected",
        last_skip_reason: "qualifying_loop_detected",
      })
      .eq("id", conversation.id)
      .eq("ai_paused", false)
      .select("id");
    if (pausedRows?.length) {
      sendHandoffEmail({
        user,
        conversation,
        reason: "qualifying_loop_detected",
        leadMessage: messageText,
      }).catch(console.error);
    }
    getPostHogClient().capture({
      distinctId: user.id,
      event: "qualifying_loop_detected",
      properties: { conversation_id: conversation.id },
    });
    return;
  }

  // ── Classifiers (parallel) ──────────────────────────────────────────
  // The DM intent classifier always runs. The human-in-loop escalation check
  // runs only when the coach enabled it. They don't depend on each other, so
  // they run concurrently: the webhook waits max(8s, 8s), not 8s + 8s. Both
  // fail open. What their outputs do to this turn is decided in one place,
  // decideIntentGate (src/lib/dm-intent-gate.js), below.
  //
  // Previously the escalation check ran first and returned on needs_human
  // before intent was classified or persisted, so escalated turns had no
  // intent record and a hostile message was paused as 'complex_objection'.
  const [escalationOutcome, intentResult] = await Promise.all([
    sc.human_in_loop ? checkEscalation(messageText, messages, sc) : null,
    classifyDMIntent({
      messageText,
      recentMessages: messages,
      scriptConfig: sc,
      offer: sc.offer,
    }).then(
      (value) => ({ value }),
      (error) => ({ error })
    ),
  ]);
  const dmIntent = intentResult.value || null;
  const dmIntentError = intentResult.error || null;
  if (dmIntentError) {
    log.warn("[webhook] dm intent classifier failed, falling through:", dmIntentError?.message);
  }

  // Persist. Best-effort write to messages.intent_classification, on the
  //    INBOUND lead row.
  //
  //    Unconditional now. It used to be `if (dmIntent && providerMessageId)`,
  //    which left NULL on every classifier failure — and NULL is
  //    indistinguishable from "the classifier never ran", so no reply decision
  //    could be audited after the fact. A failure now writes a sentinel
  //    recording that we replied anyway (failed_open), which is the existing
  //    fail-open behaviour, unchanged.
  {
    const payload = dmIntent
      ? {
          class: dmIntent.class,
          confidence: dmIntent.confidence,
          language: dmIntent.language,
          reasoning: dmIntent.reasoning,
          signals: dmIntent.signals,
          version: DM_INTENT_VERSION,
          status: "ok",
        }
      : classificationSentinel(
          /timed out after/i.test(dmIntentError?.message || "") ? "timeout" : "error",
          dmIntentError?.message || "classifyDMIntent returned no result",
          true
        );
    // The escalation check is a separate classifier that does not own this
    // column — carried alongside so its timeouts are recorded too.
    if (escalationOutcome) payload.escalation = escalationOutcome;
    await recordClassification(supabase, inboundMessageId, payload);
  }

  // Promote the conversation label from the classified intent.
  //     Only threads still at 'new' are promoted — that covers the thread
  //     just created above AND outbound-first threads (native-send echo,
  //     comment-to-DM) whose first inbound reply lands after creation. The
  //     DB write is guarded to status='new' so it can never clobber a
  //     manual change or lose a race. Fire-and-forget — a labeling write
  //     must never block or delay the reply path. Messages that classify
  //     as follow_up (the noise catch-all AND the classifier's error
  //     fallback) or below the promotion threshold leave the thread 'new'.
  if (dmIntent && conversation.status === "new") {
    const promotedStatus = statusForIntent(dmIntent.class, dmIntent.confidence);
    if (promotedStatus !== "new") {
      // Patch the local object so downstream consumers in this request
      // (drip enqueue, status detection) see the promoted status without
      // a refetch — same pattern as the origin patch above.
      conversation.status = promotedStatus;
      Promise.resolve(
        supabase
          .from("conversations")
          .update({ status: promotedStatus })
          .eq("id", conversation.id)
          .eq("status", "new")
      )
        .then(({ error }) => {
          if (error) log.warn("[webhook] status promotion failed:", error.code);
        })
        .catch((err) => log.warn("[webhook] status promotion failed:", err?.message));
    }
  }

  // Telemetry. Best-effort PostHog capture. Independent so a transient
  //    PostHog failure doesn't lose the classification or block routing.
  if (dmIntent) {
    try {
      getPostHogClient().capture({
        distinctId: user.id,
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
          distinctId: user.id,
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

  // Intent gate: decides reply / hold / pause / skip before any generation.
  // Rules live in src/lib/dm-intent-gate.js (unit-tested). A null dmIntent
  // (classifier timeout/error) replies unless the escalation check says a
  // human is needed: fail-open is deliberate.
  const gate = decideIntentGate(dmIntent, escalationOutcome);

  if (gate.action === "pause") {
    // Two sources: a confident do_not_send, or a human-in-loop escalation
    // (pauseReason 'complex_objection'). Either way, no reply this turn.
    const escalated = gate.pauseReason === "complex_objection";
    fireSenderAction(user, senderId, "typing_off");
    // Guarded to ai_paused=false so only the actual false→true transition
    // emails the owner — a retried delivery updates zero rows and stays silent.
    const { data: pausedRows } = await supabase
      .from("conversations")
      .update({
        ai_paused: true,
        ai_pause_reason: gate.pauseReason,
        // Which gate suppressed THIS turn. Distinct axis from
        // ai_pause_reason, which says why the thread is paused going forward.
        last_skip_reason: escalated ? SKIP.ESCALATED : SKIP.DO_NOT_SEND,
      })
      .eq("id", conversation.id)
      .eq("ai_paused", false)
      .select("id");
    const ownerEmailed = gate.emailOwner && Boolean(pausedRows?.length);
    if (ownerEmailed) {
      sendHandoffEmail({
        user,
        conversation,
        reason: gate.pauseReason,
        leadMessage: messageText,
      }).catch(console.error);
    }
    if (escalated) {
      getPostHogClient().capture({
        distinctId: user.id,
        event: "human_in_loop_triggered",
        properties: {
          conversation_id: conversation.id,
          reason: escalationOutcome?.reason,
          category: escalationOutcome?.category,
          intent_class: dmIntent?.class ?? null,
        },
      });
    } else {
      await logVoiceSend({
        userId: user.id,
        voiceSnippetId: null,
        conversationId: conversation.id,
        recipientPsid: senderId,
        intentClass: dmIntent.class,
        status: "skipped_do_not_send",
      });
      getPostHogClient().capture({
        distinctId: user.id,
        event: "dm_paused_do_not_send",
        properties: {
          conversation_id: conversation.id,
          pause_reason: gate.pauseReason,
          owner_emailed: ownerEmailed,
          signals: dmIntent.signals,
          reasoning: dmIntent.reasoning,
        },
      });
    }
    return;
  }

  if (gate.action === "hold" || gate.action === "skip_not_a_lead") {
    // hold: low-confidence do_not_send — no reply this turn, thread stays
    // live. skip_not_a_lead: personal / off-topic — no reply, no pause, so the
    // next on-topic message is still answered.
    fireSenderAction(user, senderId, "typing_off");
    const skipReason =
      gate.action === "hold" ? SKIP.DO_NOT_SEND_HELD : SKIP.NOT_A_LEAD;
    await markSkip(supabase, conversation.id, skipReason);
    getPostHogClient().capture({
      distinctId: user.id,
      event: gate.action === "hold" ? "dm_held_do_not_send" : "dm_skipped_not_a_lead",
      properties: {
        conversation_id: conversation.id,
        confidence: dmIntent.confidence,
        signals: dmIntent.signals,
      },
    });
    return;
  }

  // Active offer grounds prices and links for every thread (and the
  // missing-outbound-context block). Best-effort: null on any failure.
  const activeOffer = await getActiveOffer(supabase, user.id);

  // Build prompt and generate reply
  const systemPrompt = buildSystemPrompt(sc, user.calendly_url, {
    voiceProfile: user.voice_profile,
    conversation,
    activeOffer,
    owner: ownerFromUser(user),
    // Only a confident booking moment changes the prompt; see
    // buildSystemPrompt's bookingNowBlock.
    intentHint:
      dmIntent?.class === "booking_cta" && dmIntent.confidence >= 0.7
        ? "booking_cta"
        : null,
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
      // Delay floor + pause re-check before the voice send. The voice path
      // skips generateReply, so without this voice replies would land
      // near-instantly and ignore a pause during the delay window. Runs
      // before the rate-limit reservation so a blocked turn never burns a
      // 200/hr slot.
      const voiceGate = await waitDelayFloorAndRecheckGates();
      if (voiceGate.blocked) {
        fireSenderAction(user, senderId, "typing_off");
        await markSkip(supabase, conversation.id, voiceGate.reason);
        log.warn("[webhook] voice reply skipped after delay:", voiceGate.reason);
        return;
      }

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
            distinctId: user.id,
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
    // 20s + 1 retry: worst case ~41s, which leaves room inside maxDuration=60
    // for the 8s classifier cap, the insert, the outbound RPC, and the
    // 10s-capped Meta send — the 30s default could blow the budget after the
    // reply insert but before the send (orphaned assistant row).
    aiReply = await generateReply(systemPrompt, messages, {
      timeout: 20_000,
      maxRetries: 1,
    });
  } catch (err) {
    console.error("generateReply failed for conversation:", conversation.id, err.message);
    fireSenderAction(user, senderId, "typing_off");
    await markSkip(supabase, conversation.id, SKIP.GENERATION_FAILED);
    getPostHogClient().capture({
      distinctId: user.id,
      event: "ai_reply_failed",
      properties: { conversation_id: conversation.id, error: err.message },
    });
    return;
  }

  // Pre-send filter: rewrites mechanical AI tells (dashes, semicolons,
  // markdown, filler openers) and blocks leftover {{placeholders}}. See
  // src/lib/reply-lint.js.
  const lint = lintReply(aiReply, { bookingLink: user.calendly_url || "" });
  if (lint.blocked) {
    fireSenderAction(user, senderId, "typing_off");
    await markSkip(supabase, conversation.id, SKIP.REPLY_BLOCKED);
    log.warn("[webhook] reply blocked by lint (placeholder) for conversation:", conversation.id);
    getPostHogClient().capture({
      distinctId: user.id,
      event: "ai_reply_blocked",
      properties: { conversation_id: conversation.id, reason: "placeholder" },
    });
    return;
  }
  aiReply = lint.text;

  // Delay floor + pause re-check before the text send. Sits after generation
  // (so the sleep is only the remainder of the target) and BEFORE the reply
  // insert, so a turn blocked by a mid-delay pause leaves no unsent
  // assistant row in the thread. If the voice path already waited and fell
  // back to text, the remainder here is ~0 and this is just a fresh gate
  // check.
  const textGate = await waitDelayFloorAndRecheckGates();
  if (textGate.blocked) {
    fireSenderAction(user, senderId, "typing_off");
    await markSkip(supabase, conversation.id, textGate.reason);
    log.warn("[webhook] text reply skipped after delay:", textGate.reason);
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
      fireSenderAction(user, senderId, "typing_off");
      console.warn("[webhook] outbound rate-limit hit for user:", user.id);
      // Runs after the success path cleared last_skip_reason above, so this
      // re-marks the turn as suppressed. The reply row stays in the DB for
      // the owner to send by hand.
      await markSkip(supabase, conversation.id, SKIP.RATE_LIMITED);
      getPostHogClient().capture({
        distinctId: user.id,
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
        distinctId: user.id,
        event: "ai_reply_sent",
        properties: {
          conversation_id: conversation.id,
          reply_length: aiReply.length,
          lint_fixes: lint.fixes,
          lint_flags: lint.flags,
        },
      });
    } catch (err) {
      console.error("sendInstagramMessage failed for conversation:", conversation.id, err.message);
      fireSenderAction(user, senderId, "typing_off");
      // last_skip_reason was cleared optimistically before the send; the send
      // failed, so restore a suppression marker rather than leaving NULL
      // (which reads as "delivered fine").
      await markSkip(supabase, conversation.id, SKIP.SEND_FAILED);
      // A dead token (OAuth 190 + dead-session subcode/message) is not a
      // transient send failure: flag the account so the coach is told to
      // reconnect and later inbound DMs short-circuit at the dead-token gate.
      // Strict rule on purpose — a 551 (lead blocked the coach) or a 10
      // (outside the 24h window) is also an OAuthException and must NOT flag.
      if (isMetaTokenRevoked(err)) {
        await flagMetaReconnect(supabase, user.id, err, "webhook:send");
      }
      getPostHogClient().capture({
        distinctId: user.id,
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
      distinctId: user.id,
      event: "lead_status_changed",
      properties: {
        conversation_id: conversation.id,
        from_status: conversation.status,
        to_status: newStatus,
        source: "ai_detection",
      },
    });

    // Coach notifications, deferred via after() so they survive the 200
    // going out — these are value delivery to the coach, and an un-awaited
    // promise dies when the function freezes after the response.
    if (newStatus === "interested") {
      after(() => sendHotLeadAlert(user, conversation).catch(console.error));
    }
    if (newStatus === "booked") {
      after(() => sendBookingAlert(user, conversation).catch(console.error));
    }
  }

  // Insertion C — schedule a follow-up nudge after the text reply. Use the
  // resolved status so a reply that just moved the lead to booked/not_a_fit
  // never schedules a nudge.
  await maybeEnqueueDrip(newStatus);
}
