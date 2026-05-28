import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canUseDripSequences } from "@/lib/plan";
import { cancelDripForConversation } from "@/lib/drip/queue";

async function authedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase
    .from("users")
    .select("id, email, plan, subscription_status")
    .eq("id", user.id)
    .maybeSingle();

  return { user, profile };
}

// Returns the active (scheduled/processing) nudge for a conversation, used to
// render the "Follow-up scheduled in X hours" badge. Ownership is enforced by
// matching user_id on the queue row.
export async function GET(_request, { params }) {
  const { user, profile } = await authedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canUseDripSequences(profile)) {
    return NextResponse.json({ error: "upgrade_required" }, { status: 403 });
  }

  const { conversationId } = await params;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("dm_drip_queue")
    .select("id, status, scheduled_at, intent_class")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .in("status", ["scheduled", "processing"])
    .maybeSingle();

  if (error) {
    console.error("[drip-queue/conversation:GET] error:", error.message);
    return NextResponse.json({ error: "Failed to load drip" }, { status: 500 });
  }

  return NextResponse.json({ drip: data || null });
}

// Cancels the scheduled nudge for a conversation (the manual "Cancel follow-up"
// button). Only 'scheduled' rows are cancellable; a row already claimed by the
// cron ('processing') is mid-flight and left to finish.
export async function DELETE(_request, { params }) {
  const { user, profile } = await authedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canUseDripSequences(profile)) {
    return NextResponse.json({ error: "upgrade_required" }, { status: 403 });
  }

  const { conversationId } = await params;
  const admin = getSupabaseAdmin();

  // Verify the conversation belongs to this coach before canceling.
  const { data: conv } = await admin
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!conv) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const canceled = await cancelDripForConversation(conversationId, "manually_canceled");
  return NextResponse.json({ ok: true, canceled });
}
