import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canUseCommentToDM } from "@/lib/comment-to-dm-gate";

// POST /api/settings/comment-public-reply
// Body: { enabled: boolean }
//
// Flips the per-user kill switch for posting a public reply under trigger
// comments after the comment-to-DM private reply succeeds. Defaults to
// false for everyone (migration 20260612120000_comment_public_reply.sql);
// this route is the only way it turns on.

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

    const { data: profile } = await supabase
      .from("users")
      .select("plan, email")
      .eq("id", user.id)
      .maybeSingle();

    if (!canUseCommentToDM({ plan: profile?.plan, email: user.email })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    if (typeof body.enabled !== "boolean") {
      return NextResponse.json(
        { error: "enabled must be a boolean" },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();
    const { error: updateErr } = await admin
      .from("users")
      .update({ comment_public_reply_enabled: body.enabled })
      .eq("id", user.id);

    if (updateErr) {
      return NextResponse.json(
        { error: `Failed to update setting: ${updateErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, enabled: body.enabled });
  } catch (err) {
    console.error("[comment-public-reply] toggle error:", err);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}
