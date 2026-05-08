import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { generateReply } from "@/lib/anthropic";
import { buildSystemPrompt } from "@/lib/prompts";
import { sendInstagramMessage } from "@/lib/instagram";
import { decryptToken } from "@/lib/token-utils";
import { getPostHogClient } from "@/lib/posthog-server";
import { enforceAiRateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

// POST /api/conversations/[id]/force-agent
//
// Per-conversation override for the IG webhook's outreach-initiated gate.
// Lets the founder hand off an inbound thread to the agent (story replies,
// IG-app DMs they continued manually, late opt-ins) that would otherwise be
// skipped because the earliest message wasn't source='manual'.
//
// Body: { force_agent?: boolean }   // default true
// On enable: clears `last_skip_reason` if it was 'not_outreach_initiated',
// then generates+sends an agent reply against the most recent inbound message
// so the lead doesn't sit waiting.
export async function POST(request, context) {
  try {
    const { id: conversationId } = await context.params;
    if (!conversationId) {
      return NextResponse.json({ error: "Missing conversation id" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const rl = await enforceAiRateLimit(admin, user.id, "force_agent", 120);
    if (rl) return rl;

    let body = {};
    try {
      body = await request.json();
    } catch {
      // empty body — default to enabling
    }
    const force_agent = body?.force_agent === false ? false : true;

    const { data: userProfile, error: profileError } = await admin
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();
    if (profileError || !userProfile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    const { data: conversation, error: convError } = await admin
      .from("conversations")
      .select("*")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .single();
    if (convError || !conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const updates = { force_agent };
    if (force_agent && conversation.last_skip_reason === "not_outreach_initiated") {
      updates.last_skip_reason = null;
    }

    const { data: updated, error: updateError } = await admin
      .from("conversations")
      .update(updates)
      .eq("id", conversationId)
      .select()
      .single();
    if (updateError) {
      log.error("[force-agent] update failed:", updateError.code);
      return NextResponse.json({ error: "Failed to update conversation" }, { status: 500 });
    }

    getPostHogClient().capture({
      distinctId: user.email || user.id,
      event: "agent_handoff_overridden",
      properties: { conversation_id: conversationId, force_agent },
    });

    // When disabling, just return — there's nothing to send.
    if (!force_agent) {
      return NextResponse.json({ conversation: updated }, { status: 200 });
    }

    // Try to generate+send an agent reply against the most recent inbound
    // message so the lead gets a response immediately. Failures here don't
    // roll back the toggle — the next inbound message will go through the
    // normal webhook path now that force_agent is true.
    let replySent = false;
    let replyError = null;
    try {
      if (!conversation.instagram_sender_id || !userProfile.meta_page_access_token) {
        replyError = "no_messaging_channel";
      } else {
        const { data: messages, error: msgError } = await admin
          .from("messages")
          .select("role, content, source, created_at")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true })
          .limit(20);
        if (msgError) throw msgError;

        const hasInbound = (messages || []).some((m) => m.role === "user");
        if (!hasInbound) {
          replyError = "no_inbound_message";
        } else {
          const sc = userProfile.script_config || {};
          if (!sc.greeting) {
            replyError = "no_greeting";
          } else {
            const systemPrompt = buildSystemPrompt(sc, userProfile.calendly_url, {
              voiceProfile: userProfile.voice_profile,
            });
            const aiReply = await generateReply(
              systemPrompt,
              messages.map((m) => ({ role: m.role, content: m.content }))
            );

            const { error: insertErr } = await admin.from("messages").insert({
              conversation_id: conversationId,
              role: "assistant",
              content: aiReply,
              source: "agent",
            });
            if (insertErr) throw insertErr;

            await admin
              .from("conversations")
              .update({ last_message_at: new Date().toISOString(), last_skip_reason: null })
              .eq("id", conversationId);

            try {
              await sendInstagramMessage(
                userProfile.instagram_business_account_id,
                conversation.instagram_sender_id,
                aiReply,
                decryptToken(userProfile.meta_page_access_token)
              );
              replySent = true;
              getPostHogClient().capture({
                distinctId: user.email || user.id,
                event: "ai_reply_sent",
                properties: {
                  conversation_id: conversationId,
                  reply_length: aiReply.length,
                  trigger: "force_agent_handoff",
                },
              });
            } catch (sendErr) {
              replyError = "send_failed";
              log.error("[force-agent] sendInstagramMessage failed:", sendErr?.message);
              getPostHogClient().capture({
                distinctId: user.email || user.id,
                event: "message_delivery_failed",
                properties: { conversation_id: conversationId, error: sendErr?.message },
              });
            }
          }
        }
      }
    } catch (err) {
      replyError = "exception";
      log.error("[force-agent] reply generation failed:", err?.message);
    }

    return NextResponse.json(
      { conversation: updated, replySent, replyError },
      { status: 200 }
    );
  } catch (error) {
    console.error("force-agent error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
