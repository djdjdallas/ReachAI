import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { generateReply } from "@/lib/anthropic";
import { sendUnipileMessage } from "@/lib/unipile";

export async function GET() {
  // Unipile doesn't use GET verification like Meta does.
  // Return a simple health check response.
  return NextResponse.json({ status: "ok" }, { status: 200 });
}

export async function POST(request) {
  try {
    const body = await request.json();

    // Only process incoming messages for Instagram
    if (body.event !== "message_received") {
      return NextResponse.json({ status: "ignored" }, { status: 200 });
    }

    if (body.account_type !== "INSTAGRAM") {
      return NextResponse.json({ status: "ignored" }, { status: 200 });
    }

    // Ignore messages sent BY the connected account (our own outbound messages)
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
      const supabase = getSupabaseAdmin();

      // Look up which user owns this Unipile account
      const { data: user, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("unipile_account_id", accountId)
        .single();

      if (userError || !user) {
        console.error("No user found for unipile_account_id:", accountId);
        return NextResponse.json({ status: "ok" }, { status: 200 });
      }

      // Check if AI is globally active for this user
      if (!user.ai_active) {
        return NextResponse.json({ status: "ok" }, { status: 200 });
      }

      // Check subscription status
      if (!["active", "trialing"].includes(user.subscription_status)) {
        console.log("Inactive subscription for user:", user.id);
        return NextResponse.json({ status: "ok" }, { status: 200 });
      }

      // Lazy-reset monthly DM count if we've rolled into a new month
      const now = new Date();
      const resetAt = user.dm_count_reset_at
        ? new Date(user.dm_count_reset_at)
        : null;
      if (
        !resetAt ||
        now.getMonth() !== resetAt.getMonth() ||
        now.getFullYear() !== resetAt.getFullYear()
      ) {
        await supabase
          .from("users")
          .update({
            dm_count_this_month: 0,
            dm_count_reset_at: now.toISOString(),
          })
          .eq("id", user.id);
        user.dm_count_this_month = 0;
      }

      // Find or create conversation using unipile_chat_id
      let { data: conversation, error: convError } = await supabase
        .from("conversations")
        .select("*")
        .eq("user_id", user.id)
        .eq("unipile_chat_id", chatId)
        .single();

      if (convError || !conversation) {
        const { data: newConv, error: createError } = await supabase
          .from("conversations")
          .insert({
            user_id: user.id,
            instagram_sender_id: senderId,
            instagram_thread_id: chatId,
            unipile_chat_id: chatId,
            status: "qualifying",
            ai_paused: false,
            sender_name: senderName,
          })
          .select()
          .single();

        if (createError) {
          console.error("Failed to create conversation:", createError);
          return NextResponse.json({ status: "ok" }, { status: 200 });
        }
        conversation = newConv;
      }

      // If AI is paused for this conversation, still save message but skip reply
      if (conversation.ai_paused) {
        await supabase.from("messages").insert({
          conversation_id: conversation.id,
          role: "user",
          content: messageText,
        });
        return NextResponse.json({ status: "ok" }, { status: 200 });
      }

      // Check DM count against plan limit
      const dmLimit = user.plan === "unlimited" ? Infinity : 500;
      if (user.dm_count_this_month >= dmLimit) {
        console.log("DM limit reached for user:", user.id);
        return NextResponse.json({ status: "ok" }, { status: 200 });
      }

      // Save incoming message
      await supabase.from("messages").insert({
        conversation_id: conversation.id,
        role: "user",
        content: messageText,
      });

      // Add random delay 1-3 seconds to appear more natural
      await new Promise((r) =>
        setTimeout(r, 1000 + Math.random() * 2000)
      );

      // Fetch conversation history
      const { data: messages, error: msgError } = await supabase
        .from("messages")
        .select("role, content")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true })
        .limit(20);

      if (msgError) {
        console.error("Failed to fetch messages:", msgError);
        return NextResponse.json({ status: "ok" }, { status: 200 });
      }

      // Build system prompt from user's script_config
      const sc = user.script_config || {};
      const bookingLink = (user.calendly_url || "").trim();

      // objection_handlers can be a string or an object — normalize to string
      let objectionText = "";
      if (typeof sc.objection_handlers === "string") {
        objectionText = sc.objection_handlers;
      } else if (typeof sc.objection_handlers === "object" && sc.objection_handlers) {
        objectionText = Object.entries(sc.objection_handlers)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n");
      }

      const systemPrompt = `You handle Instagram DMs for a business. You qualify leads and book discovery calls.

BUSINESS CONTEXT:
Offer: ${sc.offer || "Not specified"}
Target customer: ${sc.targetCustomer || sc.target_customer || "Not specified"}
Booking link: ${bookingLink || "Not provided"}

SCRIPT REFERENCE (use as guidance, not word-for-word):
Greeting style: ${sc.greeting || "Be warm and casual."}
Qualifying questions: ${sc.qualifying_questions || "Ask about their situation, goals, and timeline."}
When they show interest: ${sc.interest_response || "Share more about the offer and suggest a call."}
Objection responses: ${objectionText || "Handle naturally."}
Booking message style: ${sc.booking_message || "Share the link casually."}
Not a fit: ${sc.not_a_fit_message || "Be honest and kind."}

HOW TO RESPOND — THIS IS CRITICAL:
- You are texting on Instagram. Write like a real person, not a marketer.
- NEVER use em dashes (—). Use commas, periods, or just start a new sentence.
- NEVER use semicolons.
- NEVER use bold or markdown formatting like **this** or *this*. Plain text only.
- Keep it SHORT. 2-3 sentences max per message. Sometimes just 1 sentence.
- Use casual language: "yeah", "honestly", "for sure", "gotcha", "nice".
- Max 1 emoji per message. Often zero. Never use multiple emojis.
- Don't start every message the same way. Vary your openers.
- Ask ONE question at a time. Never stack multiple questions.
- Don't over-explain. Be direct.
- Sound like a chill, helpful person, not a sales script.
- Avoid words like: "straightforward", "comprehensive", "leverage", "delve", "I totally get it", "absolutely".
- Use contractions always: "you're", "it's", "that's", "don't".
- Never say you're an AI. If asked directly, say you help manage messages.
- Replace {{BOOKING_LINK}} with: ${bookingLink}`;

      // Generate AI reply
      const aiReply = await generateReply(systemPrompt, messages);

      // Save AI reply
      await supabase.from("messages").insert({
        conversation_id: conversation.id,
        role: "assistant",
        content: aiReply,
      });

      // Send reply via Unipile
      await sendUnipileMessage(chatId, aiReply);

      // Status detection
      const statusOrder = ["qualifying", "interested", "booked"];
      const currentIdx = statusOrder.indexOf(conversation.status);
      let newStatus = conversation.status;

      const hasCalendlyLink =
        user.calendly_url && aiReply.includes(user.calendly_url);
      const hasBookKeyword = /\b(book|schedule|appointment)\b/i.test(aiReply);
      const hasBookedKeyword =
        /\b(confirmed|booked|see you|looking forward)\b/i.test(aiReply);

      if (
        (hasCalendlyLink || hasBookKeyword) &&
        statusOrder.indexOf("interested") > currentIdx
      ) {
        newStatus = "interested";
      }
      if (
        hasBookedKeyword &&
        statusOrder.indexOf("booked") > currentIdx
      ) {
        newStatus = "booked";
      }

      if (newStatus !== conversation.status) {
        await supabase
          .from("conversations")
          .update({ status: newStatus })
          .eq("id", conversation.id);
      }

      // Increment DM count
      await supabase
        .from("users")
        .update({
          dm_count_this_month: (user.dm_count_this_month || 0) + 1,
        })
        .eq("id", user.id);
    } catch (eventError) {
      console.error("Error processing webhook event:", eventError);
    }

    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error) {
    console.error("Webhook POST error:", error);
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }
}
