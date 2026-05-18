import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { generateReply, classifyIncomingMessage } from "@/lib/anthropic";
import { buildSystemPrompt } from "@/lib/prompts";
import { sendInstagramMessage, verifyWebhookSignature, getParticipantProfile } from "@/lib/instagram";
import { decryptToken } from "@/lib/token-utils";
import { sendHotLeadAlert, sendBookingAlert } from "@/lib/notifications";
import { getPostHogClient } from "@/lib/posthog-server";
import { log } from "@/lib/logger";

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
  // Verify signature
  const signature = request.headers.get("x-hub-signature-256");
  if (!process.env.INSTAGRAM_APP_SECRET) {
    console.warn("INSTAGRAM_APP_SECRET not set — skipping signature verification");
  } else if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const entries = body.entry || [];

  for (const entry of entries) {
    const messaging = entry.messaging || [];

    for (const event of messaging) {
      // Only process text messages (not reads, reactions, etc.)
      if (!event.message?.text) continue;

      // Ignore echo messages (messages we sent)
      if (event.message?.is_echo) continue;

      const igAccountId = event.recipient?.id; // Our Instagram Business Account ID
      const senderId = event.sender?.id; // The person who DM'd us (IGSID)
      const messageText = event.message.text;

      if (!igAccountId || !senderId || !messageText) continue;

      try {
        // Fetch sender's name from Instagram API
        // We need the user's access token — look up user first
        const supabaseForName = getSupabaseAdmin();
        const { data: ownerUser } = await supabaseForName
          .from("users")
          .select("meta_page_access_token")
          .eq("instagram_business_account_id", igAccountId)
          .single();

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
  // Bump the conversation's updated_at so the inbox reorders/realtime fires
  const { error: bumpError } = await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversation_id);
  if (bumpError) log.error("[webhook] conversation bump failed:", bumpError.code);
  return { data, error, duplicate: false };
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
      // Flag the conversation for backfill, but ONLY if origin is still
      // 'clinchd_sent'. If the dashboard's opportunistic backfill or banner
      // save raced ahead and already set origin='native_send', we must not
      // overwrite their cleared flag.
      const { data: flagged, error: flagError } = await supabase
        .from("conversations")
        .update({ missing_outbound_context: true })
        .eq("id", conversationId)
        .eq("origin", "clinchd_sent")
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

  // Look up user
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("*")
    .eq(lookupField, lookupValue)
    .single();

  if (userError || !user) {
    log.warn(`[webhook] no user for ${lookupField}:`, lookupValue);
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

  getPostHogClient().capture({
    distinctId: user.email || user.id,
    event: "message_received",
    properties: { conversation_id: conversation.id, message_length: messageText.length },
  });

  // Natural delay
  await new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000));

  // Fetch conversation history
  const { data: messages, error: msgError } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true })
    .limit(20);

  if (msgError) {
    log.error("fetch messages failed:", msgError.code);
    return;
  }

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
        last_message_at: new Date().toISOString(),
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
            last_message_at: new Date().toISOString(),
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

  // Build prompt and generate reply
  const systemPrompt = buildSystemPrompt(sc, user.calendly_url, {
    voiceProfile: user.voice_profile,
    conversation,
  });

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

  // Save AI reply
  const { error: aiInsertError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversation.id,
      role: "assistant",
      content: aiReply,
      source: "agent",
    });
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
      await sendInstagramMessage(
        user.instagram_business_account_id,
        senderId,
        aiReply,
        decryptToken(user.meta_page_access_token)
      );
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
}
