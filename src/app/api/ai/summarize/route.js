import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { summarizeConversation } from "@/lib/anthropic";
import { enforceAiRateLimit } from "@/lib/rate-limit";

export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const rl = await enforceAiRateLimit(admin, user.id, "summarize", 120);
    if (rl) return rl;

    const { conversationId } = await request.json();

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId is required" },
        { status: 400 }
      );
    }

    // Verify conversation belongs to user
    const { data: conversation, error: convError } = await admin
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Fetch messages — newest 30, restored to chronological order.
    // Ascending+limit returned the OLDEST 30, so long threads summarized
    // stale context instead of the current state of the conversation.
    const { data: messagesDesc, error: msgError } = await admin
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(30);

    const messages = (messagesDesc || []).reverse();

    if (msgError || !messages?.length) {
      return NextResponse.json(
        { error: "No messages to summarize" },
        { status: 400 }
      );
    }

    const { summary, temperature } = await summarizeConversation(messages);

    // Save to conversation
    await admin
      .from("conversations")
      .update({ ai_summary: summary, lead_temperature: temperature })
      .eq("id", conversationId);

    return NextResponse.json({ summary, temperature }, { status: 200 });
  } catch (error) {
    console.error("Summarize error:", error);
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 }
    );
  }
}
