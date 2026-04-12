import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { generateReply, classifyIncomingMessage } from "@/lib/anthropic";
import { buildSystemPrompt } from "@/lib/prompts";
import { sendInstagramMessage, verifyWebhookSignature, getParticipantProfile } from "@/lib/instagram";
import { decryptToken } from "@/lib/token-utils";
import { sendHotLeadAlert, sendBookingAlert } from "@/lib/notifications";

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
    // DEBUG: temporary logging to diagnose signature mismatch
    const crypto = await import("crypto");
    const secret = process.env.INSTAGRAM_APP_SECRET;
    const computed = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody, "utf-8").digest("hex");
    console.error("Signature mismatch debug:", {
      secretLength: secret.length,
      secretFirst4: secret.slice(0, 4),
      receivedSig: signature,
      computedSig: computed,
      bodyLength: rawBody.length,
      bodyFirst80: rawBody.slice(0, 80),
    });
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
    if (existing) {
      console.log("[webhook] duplicate message skipped:", provider_message_id);
      return { duplicate: true };
    }
  }
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id, role, content, provider_message_id })
    .select()
    .single();
  // Handle unique constraint violation (race condition fallback)
  if (error?.code === "23505") {
    console.log("[webhook] duplicate message (unique violation):", provider_message_id);
    return { duplicate: true };
  }
  if (error) {
    console.error("[webhook] message insert FAILED:", { conversation_id, role, error });
  } else {
    console.log("[webhook] message inserted:", { id: data?.id, conversation_id, role });
  }
  // Bump the conversation's updated_at so the inbox reorders/realtime fires
  const { error: bumpError } = await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversation_id);
  if (bumpError) {
    console.error("[webhook] conversation bump FAILED:", bumpError);
  }
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
    console.error(`[webhook] No user found for ${lookupField}:`, lookupValue, userError);
    return;
  }

  console.log("[webhook] processing message for user:", user.id, "sender:", senderId);

  if (!["active", "trialing"].includes(user.subscription_status)) {
    console.log("[webhook] Inactive subscription for user:", user.id, "status:", user.subscription_status);
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
      console.log("Trial expired for user:", user.id);
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
      console.error("[webhook] Failed to create conversation:", createError);
      return;
    }
    console.log("[webhook] conversation created:", newConv?.id, "for user:", user.id);
    conversation = newConv;
  } else {
    console.log("[webhook] existing conversation found:", conversation.id);
  }

  // ── Global AI mode gate ─────────────────────────────────────────────
  // 'off'     → complete silence: return without saving anything
  // 'handoff' → save inbound message for dashboard, but skip AI reply
  // 'active'  → full processing (may still be paused per-conversation)
  if (user.ai_mode === "off") {
    console.log("[webhook] ai_mode=off for user:", user.id, "— skipping entirely");
    return;
  }

  if (user.ai_mode === "handoff" || conversation.ai_paused) {
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
    await insertMessageIfNew(supabase, {
      conversation_id: conversation.id,
      role: "user",
      content: messageText,
      provider_message_id: providerMessageId,
    });
    return;
  }

  // Atomic DM limit check — increment first, then verify
  const dmLimit = user.plan === "unlimited" ? Infinity : 500;
  if (dmLimit !== Infinity) {
    const { data: newCount, error: rpcError } = await supabase.rpc("increment_dm_count", { uid: user.id });
    if (rpcError) {
      console.error("Failed to increment DM count:", rpcError);
      return;
    }
    if (newCount > dmLimit) {
      console.log("DM limit reached for user:", user.id);
      return;
    }
  }

  // Save incoming message (with deduplication)
  const insertResult = await insertMessageIfNew(supabase, {
    conversation_id: conversation.id,
    role: "user",
    content: messageText,
    provider_message_id: providerMessageId,
  });
  if (insertResult.duplicate) {
    console.log("Duplicate message skipped:", providerMessageId);
    return;
  }

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
    console.error("Failed to fetch messages:", msgError);
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
        console.log(
          "[webhook] human-in-loop pause:",
          conversation.id,
          classification.reason
        );
        return;
      }
    } catch (err) {
      console.warn(
        "[webhook] classifier failed, falling through to normal reply:",
        err?.message
      );
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
    return;
  }

  // Save AI reply
  const { data: aiMsg, error: aiInsertError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversation.id,
      role: "assistant",
      content: aiReply,
    })
    .select()
    .single();
  if (aiInsertError) {
    console.error("[webhook] AI reply insert FAILED:", aiInsertError);
  } else {
    console.log("[webhook] AI reply inserted:", aiMsg?.id);
  }
  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversation.id);

  // Send reply via Meta Instagram API
  try {
    await sendInstagramMessage(
      user.instagram_business_account_id,
      senderId,
      aiReply,
      decryptToken(user.meta_page_access_token)
    );
  } catch (err) {
    console.error("sendInstagramMessage failed for conversation:", conversation.id, err.message);
    // Reply is saved to DB but wasn't delivered — continue to status detection
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
    console.log(`Status change: ${conversation.id} ${conversation.status} → ${newStatus}`);
    await supabase.from("conversations").update({ status: newStatus }).eq("id", conversation.id);

    // Fire-and-forget notification alerts
    if (newStatus === "interested") {
      sendHotLeadAlert(user, conversation).catch(console.error);
    }
    if (newStatus === "booked") {
      sendBookingAlert(user, conversation).catch(console.error);
    }
  }
}
