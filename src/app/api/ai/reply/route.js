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

    // Subscription / trial / DM-cap gate — mirrors the webhook AI path at
    // src/app/api/webhooks/instagram/route.js:409-552 so manual dashboard
    // sends can't bypass the same enforcement inbound replies get.
    if (!["active", "trialing"].includes(userProfile.subscription_status)) {
      return NextResponse.json(
        { error: "subscription_inactive" },
        { status: 402 }
      );
    }

    if (userProfile.subscription_status === "trialing") {
      const trialEnd = userProfile.trial_ends_at
        ? new Date(userProfile.trial_ends_at)
        : null;
      if (trialEnd && new Date() > trialEnd) {
        // Side-effect parity with the webhook: flip to expired + ai_mode off
        // so the TrialExpiredGate modal and webhook path stay consistent.
        await getSupabaseAdmin()
          .from("users")
          .update({ subscription_status: "expired", ai_mode: "off" })
          .eq("id", user.id);
        return NextResponse.json(
          { error: "trial_expired" },
          { status: 402 }
        );
      }
    }

    // Atomic DM cap — non-unlimited plans only. Reserved BEFORE generation so
    // we don't burn LLM cycles when over cap. If the downstream send fails,
    // we accept the count (same trade-off as the webhook path).
    const dmLimit = userProfile.plan === "unlimited" ? Infinity : 1500;
    if (dmLimit !== Infinity) {
      const { data: newCount, error: rpcError } = await getSupabaseAdmin()
        .rpc("increment_dm_count", { uid: user.id });
      if (rpcError) {
        console.error("[ai-reply] increment_dm_count failed:", rpcError.code);
        return NextResponse.json(
          { error: "dm_count_failed" },
          { status: 500 }
        );
      }
      if (newCount > dmLimit) {
        return NextResponse.json(
          { error: "dm_cap_reached" },
          { status: 402 }
        );
      }
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
      // AI-generated reply. Fetch the newest 20 messages and restore
      // chronological order — ascending+limit returned the OLDEST 20 and
      // dropped recent context on long threads.
      const { data: messagesDesc, error: msgError } = await getSupabaseAdmin()
        .from("messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (msgError) {
        return NextResponse.json(
          { error: "Failed to fetch messages" },
          { status: 500 }
        );
      }

      const messages = (messagesDesc || []).reverse();

      const systemPrompt = buildSystemPrompt(
        userProfile.script_config,
        userProfile.calendly_url,
        { voiceProfile: userProfile.voice_profile, conversation }
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
        source: manual ? "manual" : "agent",
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
    const sendResult = await sendInstagramMessage(
      userProfile.instagram_business_account_id,
      conversation.instagram_sender_id,
      replyContent,
      decryptToken(userProfile.meta_page_access_token)
    );

    // Stamp the Meta mid so the echo of this send dedups in the webhook.
    if (savedMessage?.id && sendResult?.message_id) {
      const { error: midError } = await getSupabaseAdmin()
        .from("messages")
        .update({ provider_message_id: sendResult.message_id })
        .eq("id", savedMessage.id);
      if (midError) console.error("[ai-reply] mid stamp failed:", midError.code);
    }

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
