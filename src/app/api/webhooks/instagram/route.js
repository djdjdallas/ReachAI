import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { generateReply } from "@/lib/anthropic";
import { buildSystemPrompt } from "@/lib/prompts";
import { sendUnipileMessage } from "@/lib/unipile";
import { sendInstagramMessage, verifyWebhookSignature } from "@/lib/instagram";

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

  // Fallback health check (also used by Unipile)
  return NextResponse.json({ status: "ok" }, { status: 200 });
}

// ── POST: Handle incoming messages (Meta or Unipile) ────────────────────

export async function POST(request) {
  try {
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);

    // Detect whether this is a Meta or Unipile webhook based on payload shape
    if (body.object === "instagram") {
      return handleMetaWebhook(body, rawBody, request);
    }

    // Unipile webhook (legacy)
    if (body.event === "message_received") {
      return handleUnipileWebhook(body);
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
  if (process.env.FACEBOOK_APP_SECRET && !verifyWebhookSignature(rawBody, signature)) {
    console.error("Meta webhook signature verification failed");
    return NextResponse.json({ status: "ok" }, { status: 200 });
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
        await processIncomingMessage({
          lookupField: "instagram_business_account_id",
          lookupValue: igAccountId,
          senderId,
          messageText,
          senderName: null, // Meta doesn't include name in webhook; could fetch separately
          connectionType: "meta",
        });
      } catch (err) {
        console.error("Error processing Meta message:", err);
      }
    }
  }

  return NextResponse.json({ status: "ok" }, { status: 200 });
}

// ── Unipile webhook (legacy fallback) ───────────────────────────────────

async function handleUnipileWebhook(body) {
  if (body.account_type !== "INSTAGRAM") {
    return NextResponse.json({ status: "ignored" }, { status: 200 });
  }

  if (body.is_sender === true) {
    return NextResponse.json({ status: "ignored_own_message" }, { status: 200 });
  }

  const accountId = body.account_id;
  const chatId = body.chat_id;
  const messageText = body.message;
  const senderName = body.sender?.attendee_name || null;
  const senderId = body.sender?.attendee_provider_id || body.sender?.attendee_id || null;

  if (!messageText || !accountId) {
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }

  try {
    await processIncomingMessage({
      lookupField: "unipile_account_id",
      lookupValue: accountId,
      senderId,
      messageText,
      senderName,
      connectionType: "unipile",
      unipileChatId: chatId,
    });
  } catch (err) {
    console.error("Error processing Unipile message:", err);
  }

  return NextResponse.json({ status: "ok" }, { status: 200 });
}

// ── Shared message processing logic ─────────────────────────────────────

async function processIncomingMessage({
  lookupField,
  lookupValue,
  senderId,
  messageText,
  senderName,
  connectionType,
  unipileChatId,
}) {
  const supabase = getSupabaseAdmin();

  // Look up user
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("*")
    .eq(lookupField, lookupValue)
    .single();

  if (userError || !user) {
    console.error(`No user found for ${lookupField}:`, lookupValue);
    return;
  }

  if (!user.ai_active) return;

  if (!["active", "trialing"].includes(user.subscription_status)) {
    console.log("Inactive subscription for user:", user.id);
    return;
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

  // Find or create conversation
  // For Meta: match by instagram_sender_id + user_id
  // For Unipile: match by unipile_chat_id
  let conversation;

  if (connectionType === "meta") {
    const { data: conv } = await supabase
      .from("conversations")
      .select("*")
      .eq("user_id", user.id)
      .eq("instagram_sender_id", senderId)
      .single();
    conversation = conv;
  } else {
    const { data: conv } = await supabase
      .from("conversations")
      .select("*")
      .eq("user_id", user.id)
      .eq("unipile_chat_id", unipileChatId)
      .single();
    conversation = conv;
  }

  if (!conversation) {
    const insertData = {
      user_id: user.id,
      instagram_sender_id: senderId,
      status: "qualifying",
      ai_paused: false,
      sender_name: senderName,
    };

    if (connectionType === "unipile") {
      insertData.instagram_thread_id = unipileChatId;
      insertData.unipile_chat_id = unipileChatId;
    }

    const { data: newConv, error: createError } = await supabase
      .from("conversations")
      .insert(insertData)
      .select()
      .single();

    if (createError) {
      console.error("Failed to create conversation:", createError);
      return;
    }
    conversation = newConv;
  }

  // If AI is paused, save message but skip reply
  if (conversation.ai_paused) {
    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      role: "user",
      content: messageText,
    });
    return;
  }

  // Check DM limit
  const dmLimit = user.plan === "unlimited" ? Infinity : 500;
  if (user.dm_count_this_month >= dmLimit) {
    console.log("DM limit reached for user:", user.id);
    return;
  }

  // Skip if no script configured
  const sc = user.script_config || {};
  if (!sc.greeting) {
    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      role: "user",
      content: messageText,
    });
    return;
  }

  // Save incoming message
  await supabase.from("messages").insert({
    conversation_id: conversation.id,
    role: "user",
    content: messageText,
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
    console.error("Failed to fetch messages:", msgError);
    return;
  }

  // Build prompt and generate reply
  const systemPrompt = buildSystemPrompt(sc, user.calendly_url, {
    voiceProfile: user.voice_profile,
  });
  const aiReply = await generateReply(systemPrompt, messages);

  // Save AI reply
  await supabase.from("messages").insert({
    conversation_id: conversation.id,
    role: "assistant",
    content: aiReply,
  });

  // Send reply via the appropriate channel
  if (connectionType === "meta") {
    await sendInstagramMessage(
      user.instagram_business_account_id,
      senderId,
      aiReply,
      user.meta_page_access_token
    );
  } else {
    await sendUnipileMessage(unipileChatId, aiReply);
  }

  // Status detection
  const statusOrder = ["qualifying", "interested", "booked"];
  const currentIdx = statusOrder.indexOf(conversation.status);
  let newStatus = conversation.status;

  const hasCalendlyLink = user.calendly_url && aiReply.includes(user.calendly_url);
  const hasBookKeyword =
    /\b(book a call|schedule a call|book a slot|grab a spot|set up a time|appointment)\b/i.test(aiReply);
  const hasBookedKeyword =
    hasCalendlyLink &&
    /\b(confirmed|booked|see you (on|soon|then)|looking forward to (the call|our call|chatting|speaking))\b/i.test(aiReply);
  const hasNotAFitKeyword =
    /\b(not (the right|a good|a great) fit|not quite what|might not be (for you|the best))\b/i.test(aiReply);

  if ((hasCalendlyLink || hasBookKeyword) && statusOrder.indexOf("interested") > currentIdx) {
    newStatus = "interested";
  }
  if (hasBookedKeyword && statusOrder.indexOf("booked") > currentIdx) {
    newStatus = "booked";
  }
  if (hasNotAFitKeyword && conversation.status !== "booked") {
    newStatus = "not_a_fit";
  }

  if (newStatus !== conversation.status) {
    await supabase.from("conversations").update({ status: newStatus }).eq("id", conversation.id);
  }

  // Increment DM count
  await supabase
    .from("users")
    .update({ dm_count_this_month: (user.dm_count_this_month || 0) + 1 })
    .eq("id", user.id);
}
