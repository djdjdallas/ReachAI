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
    console.warn("[ig-webhook] signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const entries = body.entry || [];

  for (const entry of entries) {
    const messaging = entry.messaging || [];
    console.log("[ig-webhook] entry messaging count:", messaging.length);

    for (const event of messaging) {
      console.log("[ig-webhook] event keys:", Object.keys(event || {}), "has_text:", !!event.message?.text, "is_echo:", !!event.message?.is_echo);
      // Only process text messages (not reads, reactions, etc.)
      if (!event.message?.text) continue;

      // Ignore echo messages (messages we sent)
      if (event.message?.is_echo) continue;

      const igAccountId = event.recipient?.id; // Our Instagram Business Account ID
      const senderId = event.sender?.id; // The person who DM'd us (IGSID)
      const messageText = event.message.text;
      console.log("[ig-webhook] inbound", { igAccountId, senderId, len: messageText?.length, mid: event.message?.mid });

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
        if (ownerUser?.meta_page_access_token) {
          const pageToken = decryptToken(ownerUser.meta_page_access_token);
          const profile = await getParticipantProfile(senderId, pageToken);
          senderName = profile?.name || profile?.username || null;
        }

        await processIncomingMessage({
          lookupField: "instagram_business_account_id",
          lookupValue: igAccountId,
          senderId,
          messageText,
          senderName,
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

async function insertMessageIfNew(supabase, { conversation_id, role, content, provider_message_id }) {
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
    .insert({ conversation_id, role, content, provider_message_id })
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

// ── Shared message processing logic ─────────────────────────────────────

async function processIncomingMessage({
  lookupField,
  lookupValue,
  senderId,
  messageText,
  senderName,
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
  console.log("[ig-webhook] user:", { id: user.id, ai_mode: user.ai_mode, sub_status: user.subscription_status, has_greeting: !!user.script_config?.greeting });

  if (!["active", "trialing"].includes(user.subscription_status)) return;

  // Fix #1: Check trial expiry
  if (user.subscription_status === "trialing") {
    const trialEnd = user.trial_ends_at ? new Date(user.trial_ends_at) : null;
    if (trialEnd && new Date() > trialEnd) {
      await supabase
        .from("users")
        .update({ subscription_status: "expired", ai_mode: "off" })
        .eq("id", user.id);
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

  const { data: conv } = await supabase
    .from("conversations")
    .select("*")
    .eq("user_id", user.id)
    .eq("instagram_sender_id", senderId)
    .maybeSingle();
  conversation = conv;

  if (!conversation) {
    console.log("[ig-webhook] creating new conversation for sender:", senderId);
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
  }
  console.log("[ig-webhook] conversation:", { id: conversation.id, ai_paused: conversation.ai_paused, ai_pause_reason: conversation.ai_pause_reason, status: conversation.status });

  // ── Global AI mode gate ─────────────────────────────────────────────
  // 'off'     → complete silence: return without saving anything
  // 'handoff' → save inbound message for dashboard, but skip AI reply
  // 'active'  → full processing (may still be paused per-conversation)
  if (user.ai_mode === "off") {
    console.log("[ig-webhook] gate=ai_mode_off skipping");
    return;
  }

  if (user.ai_mode === "handoff" || conversation.ai_paused) {
    console.log("[ig-webhook] gate=handoff_or_paused skipping AI reply", { ai_mode: user.ai_mode, ai_paused: conversation.ai_paused, ai_pause_reason: conversation.ai_pause_reason });
    await insertMessageIfNew(supabase, {
      conversation_id: conversation.id,
      role: "user",
      content: messageText,
      provider_message_id: providerMessageId,
    });
    return;
  }

  // Skip if no script configured
  const sc = user.script_config || {};
  if (!sc.greeting) {
    console.log("[ig-webhook] gate=no_greeting skipping AI reply");
    await insertMessageIfNew(supabase, {
      conversation_id: conversation.id,
      role: "user",
      content: messageText,
      provider_message_id: providerMessageId,
    });
    return;
  }
  console.log("[ig-webhook] reaching agent invocation for conversation:", conversation.id);

  // Atomic DM limit check — increment first, then verify
  const dmLimit = user.plan === "unlimited" ? Infinity : 500;
  if (dmLimit !== Infinity) {
    const { data: newCount, error: rpcError } = await supabase.rpc("increment_dm_count", { uid: user.id });
    if (rpcError) {
      log.error("increment_dm_count failed:", rpcError.code);
      return;
    }
    if (newCount > dmLimit) return;
  }

  // Save incoming message (with deduplication)
  const insertResult = await insertMessageIfNew(supabase, {
    conversation_id: conversation.id,
    role: "user",
    content: messageText,
    provider_message_id: providerMessageId,
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
    });
  if (aiInsertError) log.error("[webhook] AI reply insert failed:", aiInsertError.code);
  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
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
