import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { generateReply } from "@/lib/anthropic";
import { sendMessage } from "@/lib/instagram";
import { decrypt } from "@/lib/encryption";

export async function POST(request) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId, message, manual } = await request.json();

    if (!conversationId || !message) {
      return NextResponse.json(
        { error: "conversationId and message are required" },
        { status: 400 }
      );
    }

    // Fetch user profile
    const { data: userProfile, error: profileError } = await getSupabaseAdmin()
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    // Fetch conversation
    const { data: conversation, error: convError } = await getSupabaseAdmin()
      .from("conversations")
      .select("*")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const accessToken = decrypt(userProfile.instagram_token);
    let replyContent;

    if (manual) {
      // Manual reply — save and send directly
      replyContent = message;
    } else {
      // AI-generated reply
      const { data: messages, error: msgError } = await getSupabaseAdmin()
        .from("messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(20);

      if (msgError) {
        return NextResponse.json(
          { error: "Failed to fetch messages" },
          { status: 500 }
        );
      }

      const scriptConfig = userProfile.script_config || {};
      const systemPrompt = `You are a friendly and helpful Instagram DM assistant for a business. Your goal is to qualify leads, handle objections, and guide interested prospects to book a call.

Business Details:
- Offer: ${scriptConfig.offer || "Not specified"}
- Target Customer: ${scriptConfig.target_customer || "Not specified"}
- Booking Link: ${userProfile.calendly_url || "Not provided"}

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
3. When the prospect seems interested and qualified, share the booking link: ${userProfile.calendly_url || "{{BOOKING_LINK}}"}
4. Keep messages conversational, concise, and friendly. Avoid sounding robotic or overly salesy.
5. If they are not a good fit, politely let them know.
6. Never reveal that you are an AI assistant.`;

      // Add the new user message to the history for AI context
      const allMessages = [
        ...messages,
        { role: "user", content: message },
      ];

      replyContent = await generateReply(systemPrompt, allMessages);
    }

    // Save message to database
    const { data: savedMessage, error: saveError } = await getSupabaseAdmin()
      .from("messages")
      .insert({
        conversation_id: conversationId,
        role: "assistant",
        content: replyContent,
      })
      .select()
      .single();

    if (saveError) {
      return NextResponse.json(
        { error: "Failed to save message" },
        { status: 500 }
      );
    }

    // Send via Instagram
    await sendMessage(
      userProfile.instagram_user_id,
      conversation.instagram_sender_id,
      replyContent,
      accessToken
    );

    return NextResponse.json({ message: savedMessage }, { status: 200 });
  } catch (error) {
    console.error("AI reply error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
