import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getPostHogClient } from "@/lib/posthog-server";
import { log } from "@/lib/logger";
import { attachToConversation } from "@/lib/native-send";

// POST /api/native-send
// Logs a manually-sent cold DM. If the lead already replied (edge case #1),
// opportunistically backfills the matching conversation in the same request.
//
// Body: { recipient_handle, recipient_ig_user_id?, dm_text, sent_at? }
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

  const dmText = (body.dm_text || "").trim();
  const handle = normaliseHandle(body.recipient_handle);
  const igUserId = (body.recipient_ig_user_id || "").trim() || null;

  if (!dmText) {
    return NextResponse.json({ error: "dm_text is required" }, { status: 400 });
  }
  if (!handle && !igUserId) {
    return NextResponse.json(
      { error: "Provide at least recipient_handle or recipient_ig_user_id" },
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

  // Insert the native_send_outbound row.
  const { data: inserted, error: insertError } = await admin
    .from("native_send_outbound")
    .insert({
      user_id: user.id,
      recipient_handle: handle || null,
      recipient_ig_user_id: igUserId,
      dm_text: dmText,
      sent_at: sentAt,
    })
    .select()
    .single();

  if (insertError) {
    log.error("[native-send] insert failed:", insertError.code);
    return NextResponse.json({ error: "Failed to log native send" }, { status: 500 });
  }

  getPostHogClient().capture({
    distinctId: user.email || user.id,
    event: "native_send_logged",
    properties: { native_send_id: inserted.id, has_ig_user_id: !!igUserId },
  });

  // Opportunistic backfill (edge case #1): if a missing-context conversation
  // already exists for this lead, link it now so the AI sees the full thread
  // on its next turn. Requires a deterministic match key — only attempt when
  // recipient_ig_user_id is provided, since conversations store IGSID not
  // handle. Handle-only backfills happen via the in-thread banner (step 6).
  let backfilled = null;
  if (igUserId) {
    const { data: candidateConv } = await admin
      .from("conversations")
      .select("id, origin, missing_outbound_context")
      .eq("user_id", user.id)
      .eq("instagram_sender_id", igUserId)
      .eq("missing_outbound_context", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (candidateConv) {
      backfilled = await attachToConversation(admin, {
        userId: user.id,
        userEmail: user.email,
        conversationId: candidateConv.id,
        nativeSendId: inserted.id,
        dmText,
        sentAt,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    native_send: inserted,
    backfilled_conversation_id: backfilled?.conversationId || null,
  });
}

// GET /api/native-send
// Returns this user's recent native-send logs with match status.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("native_send_outbound")
    .select("id, recipient_handle, recipient_ig_user_id, dm_text, sent_at, matched_conversation_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    log.error("[native-send] list failed:", error.code);
    return NextResponse.json({ error: "Failed to load logs" }, { status: 500 });
  }

  return NextResponse.json({ rows: data || [] });
}

// ─── helpers ──────────────────────────────────────────────────────────────

function normaliseHandle(raw) {
  return (raw || "").trim().replace(/^@+/, "");
}
