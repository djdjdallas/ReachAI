import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { generateReply } from "@/lib/anthropic";
import { buildSystemPrompt } from "@/lib/prompts";
import { sendUnipileMessage } from "@/lib/unipile";

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

    if (!conversation.unipile_chat_id) {
      return NextResponse.json(
        { error: "Conversation has no Unipile chat ID" },
        { status: 400 }
      );
    }

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

      const systemPrompt = buildSystemPrompt(
        userProfile.script_config,
        userProfile.calendly_url
      );

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

    // Send via Unipile
    await sendUnipileMessage(conversation.unipile_chat_id, replyContent);

    return NextResponse.json({ message: savedMessage }, { status: 200 });
  } catch (error) {
    console.error("AI reply error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
