import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { generateReply } from "@/lib/anthropic";
import { sendMessage, getParticipantProfile } from "@/lib/instagram";
import { decrypt } from "@/lib/encryption";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    if (
      mode === "subscribe" &&
      token === process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN
    ) {
      return new NextResponse(challenge, { status: 200 });
    }

    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } catch (error) {
    console.error("Webhook verification error:", error);
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    const entries = body.entry || [];

    for (const entry of entries) {
      const messaging = entry.messaging || [];
      const pageId = entry.id;

      for (const event of messaging) {
        if (!event.message || event.message.is_echo) continue;

        const senderId = event.sender.id;
        const messageText = event.message.text;

        if (!messageText) continue;

        try {
          const supabase = getSupabaseAdmin();

          // Look up which user owns this Instagram account
          const { data: user, error: userError } = await supabase
            .from("users")
            .select("*")
            .eq("instagram_page_id", pageId)
            .single();

          if (userError || !user) {
            console.error("No user found for page_id:", pageId);
            continue;
          }

          // Fix 4: Check if AI is globally active for this user
          if (!user.ai_active) continue;

          // Fix 5: Check subscription status — only serve active/trialing users
          if (!["active", "trialing"].includes(user.subscription_status)) {
            console.log("Inactive subscription for user:", user.id);
            continue;
          }

          // Fix 7: Lazy-reset monthly DM count if we've rolled into a new month
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

          // Find or create conversation
          let { data: conversation, error: convError } = await supabase
            .from("conversations")
            .select("*")
            .eq("user_id", user.id)
            .eq("instagram_sender_id", senderId)
            .single();

          if (convError || !conversation) {
            // Fix 9: Try to fetch sender profile for sender_name
            let senderName = null;
            try {
              const accessToken = decrypt(user.instagram_token);
              const profile = await getParticipantProfile(
                senderId,
                accessToken
              );
              senderName = profile?.name || null;
            } catch (profileErr) {
              console.warn("Could not fetch sender profile:", profileErr.message);
            }

            // Fix 1: Use valid status "qualifying" and provide instagram_thread_id
            const { data: newConv, error: createError } = await supabase
              .from("conversations")
              .insert({
                user_id: user.id,
                instagram_sender_id: senderId,
                instagram_thread_id: `${pageId}_${senderId}`,
                status: "qualifying",
                ai_paused: false,
                sender_name: senderName,
              })
              .select()
              .single();

            if (createError) {
              console.error("Failed to create conversation:", createError);
              continue;
            }
            conversation = newConv;
          }

          // If AI is paused for this conversation, skip AI reply
          if (conversation.ai_paused) {
            // Still save the incoming message
            // Fix 2: Remove nonexistent instagram_message_id and timestamp columns
            await supabase.from("messages").insert({
              conversation_id: conversation.id,
              role: "user",
              content: messageText,
            });
            continue;
          }

          // Fix 3: Check DM count against plan limit using correct column name
          const dmLimit = user.plan === "unlimited" ? Infinity : 500;
          if (user.dm_count_this_month >= dmLimit) {
            console.log("DM limit reached for user:", user.id);
            continue;
          }

          // Save incoming message
          // Fix 2: Remove nonexistent instagram_message_id and timestamp columns
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
            continue;
          }

          // Build system prompt from user's script_config
          const scriptConfig = user.script_config || {};
          const systemPrompt = `You are a friendly and helpful Instagram DM assistant for a business. Your goal is to qualify leads, handle objections, and guide interested prospects to book a call.

Business Details:
- Offer: ${scriptConfig.offer || "Not specified"}
- Target Customer: ${scriptConfig.target_customer || "Not specified"}
- Booking Link: ${user.calendly_url || "Not provided"}

Objection Handlers:
${
  scriptConfig.objection_handlers
    ? Object.entries(scriptConfig.objection_handlers)
        .map(([objection, response]) => `- If they say "${objection}": ${response}`)
        .join("\n")
    : "Handle objections naturally and empathetically."
}

Instructions:
1. Qualify the lead by understanding their needs and if they match the target customer profile.
2. Handle any objections they raise using the provided objection handlers.
3. When the prospect seems interested and qualified, share the booking link: ${user.calendly_url || "{{BOOKING_LINK}}"}
4. Keep messages conversational, concise, and friendly. Avoid sounding robotic or overly salesy.
5. If they are not a good fit, politely let them know.
6. Never reveal that you are an AI assistant.`;

          // Generate AI reply
          const aiReply = await generateReply(systemPrompt, messages);

          // Save AI reply
          await supabase.from("messages").insert({
            conversation_id: conversation.id,
            role: "assistant",
            content: aiReply,
          });

          // Send reply via Instagram
          const accessToken = decrypt(user.instagram_token);
          await sendMessage(
            user.instagram_user_id,
            senderId,
            aiReply,
            accessToken
          );

          // Fix 11: Improved status detection — only escalate forward, use word boundaries
          const statusOrder = ["qualifying", "interested", "booked"];
          const currentIdx = statusOrder.indexOf(conversation.status);
          let newStatus = conversation.status;

          // Primary signal: Calendly URL presence means "interested"
          const hasCalendlyLink =
            user.calendly_url && aiReply.includes(user.calendly_url);
          // Word-boundary regex for booking keywords to avoid "Facebook", "ebook" etc.
          const hasBookKeyword = /\b(book|schedule|appointment)\b/i.test(
            aiReply
          );
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
          console.error("Error processing messaging event:", eventError);
          continue;
        }
      }
    }

    // Always return 200 OK — Instagram requires fast response
    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error) {
    console.error("Webhook POST error:", error);
    // Still return 200 to prevent Instagram from retrying
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }
}
