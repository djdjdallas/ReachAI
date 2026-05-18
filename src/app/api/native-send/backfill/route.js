import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { log } from "@/lib/logger";
import { attachToConversation } from "@/lib/native-send";

// POST /api/native-send/backfill
// Backfills the original outbound DM for a conversation flagged
// missing_outbound_context. Creates a native_send_outbound row pre-matched
// to this conversation, injects the message into history, clears the flag.
//
// Body: { conversationId, dm_text, sent_at? }
export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const conversationId = (body.conversationId || "").trim();
  const dmText = (body.dm_text || "").trim();
  if (!conversationId || !dmText) {
    return NextResponse.json(
      { error: "conversationId and dm_text are required" },
      { status: 400 }
    );
  }

  let sentAt;
  if (body.sent_at) {
    const parsed = new Date(body.sent_at);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Invalid sent_at" }, { status: 400 });
    }
    sentAt = parsed.toISOString();
  } else {
    sentAt = new Date().toISOString();
  }

  const admin = getSupabaseAdmin();

  // Verify the conversation belongs to this user (RLS would also catch this,
  // but explicit ownership check + sender_id lookup in one query is cheaper).
  const { data: conv, error: convError } = await admin
    .from("conversations")
    .select("id, user_id, instagram_sender_id, sender_name, missing_outbound_context")
    .eq("id", conversationId)
    .eq("user_id", user.id)
    .single();

  if (convError || !conv) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  // Insert the native_send_outbound row pre-matched to this conversation. The
  // recipient_handle field stores sender_name as a fallback identifier; the
  // primary link is via matched_conversation_id (set below by attachToConversation).
  const { data: inserted, error: insertError } = await admin
    .from("native_send_outbound")
    .insert({
      user_id: user.id,
      recipient_handle: conv.sender_name || null,
      recipient_ig_user_id: conv.instagram_sender_id || null,
      dm_text: dmText,
      sent_at: sentAt,
    })
    .select()
    .single();

  if (insertError) {
    log.error("[native-send-backfill] insert failed:", insertError.code);
    return NextResponse.json({ error: "Failed to save backfill" }, { status: 500 });
  }

  const linked = await attachToConversation(admin, {
    userId: user.id,
    userEmail: user.email,
    conversationId,
    nativeSendId: inserted.id,
    dmText,
    sentAt,
  });

  if (!linked) {
    // The native_send row was created but the link/inject failed. Surface a
    // server error — the row is recoverable from the dashboard if needed.
    return NextResponse.json(
      { error: "Saved but failed to link to conversation" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, native_send_id: inserted.id });
}
