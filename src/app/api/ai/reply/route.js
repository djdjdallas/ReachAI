import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { generateReply } from "@/lib/anthropic";
import { buildSystemPrompt } from "@/lib/prompts";
import { sendInstagramMessage } from "@/lib/instagram";
import { decryptToken } from "@/lib/token-utils";
import { getPostHogClient } from "@/lib/posthog-server";
import { enforceAiRateLimit } from "@/lib/rate-limit";

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

    const admin = getSupabaseAdmin();
    const rl = await enforceAiRateLimit(admin, user.id, "ai_reply", 600);
    if (rl) return rl;

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

    // Verify we have a valid messaging channel
    if (!conversation.instagram_sender_id || !userProfile.meta_page_access_token) {
      return NextResponse.json(
        { error: "Conversation has no valid messaging channel" },
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
        userProfile.calendly_url,
        { voiceProfile: userProfile.voice_profile }
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

    // Send via Meta Instagram API
    await sendInstagramMessage(
      userProfile.instagram_business_account_id,
      conversation.instagram_sender_id,
      replyContent,
      decryptToken(userProfile.meta_page_access_token)
    );

    getPostHogClient().capture({
      distinctId: user.email || user.id,
      event: "dashboard_reply_sent",
      properties: { conversation_id: conversationId, message_length: replyContent.length, manual: !!manual },
    });

    return NextResponse.json({ message: savedMessage }, { status: 200 });
  } catch (error) {
    console.error("AI reply error:", error);
    getPostHogClient().capture({
      distinctId: "unknown",
      event: "dashboard_reply_failed",
      properties: { endpoint: "/api/ai/reply", error: error.message },
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
