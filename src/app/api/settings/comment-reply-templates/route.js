import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canUseCommentToDM } from "@/lib/comment-to-dm-gate";

// /api/settings/comment-reply-templates
//
// CRUD for the per-user pool of public comment-reply phrasings
// (comment_reply_templates). The pool is the spam-safety mechanism for the
// public-reply feature — the webhook rotates through active rows so the
// same text never posts twice in a row on a post.
//
//   POST   { reply_text }                  → create, returns the new row
//   PATCH  { id, reply_text?, is_active? } → edit text and/or toggle active
//   DELETE { id }                          → remove
//
// All writes go through the admin client scoped by user_id (matching the
// dm-templates route); RLS on the table covers any client-side reads.

// Instagram caps comments at 2200 chars; a conversion nudge should be far
// shorter. 500 leaves headroom without letting essays through.
const REPLY_MAX_LEN = 500;

async function authorize() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("plan, email")
    .eq("id", user.id)
    .maybeSingle();

  if (!canUseCommentToDM({ plan: profile?.plan, email: user.email })) {
    return { errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user };
}

export async function POST(request) {
  try {
    const { user, errorResponse } = await authorize();
    if (errorResponse) return errorResponse;

    const body = await request.json().catch(() => ({}));
    const replyText =
      typeof body.reply_text === "string" ? body.reply_text.trim() : "";

    if (!replyText) {
      return NextResponse.json({ error: "reply_text is required" }, { status: 400 });
    }
    if (replyText.length > REPLY_MAX_LEN) {
      return NextResponse.json(
        { error: `reply_text too long (max ${REPLY_MAX_LEN} chars)` },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();
    const { data: row, error: insertErr } = await admin
      .from("comment_reply_templates")
      .insert({ user_id: user.id, reply_text: replyText })
      .select("id, reply_text, is_active, created_at")
      .single();

    if (insertErr) {
      return NextResponse.json(
        { error: `Failed to create reply: ${insertErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, template: row });
  } catch (err) {
    console.error("[comment-reply-templates] POST error:", err);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { user, errorResponse } = await authorize();
    if (errorResponse) return errorResponse;

    const body = await request.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const updates = {};
    if (typeof body.reply_text === "string") {
      const trimmed = body.reply_text.trim();
      if (!trimmed) {
        return NextResponse.json({ error: "reply_text cannot be empty" }, { status: 400 });
      }
      if (trimmed.length > REPLY_MAX_LEN) {
        return NextResponse.json(
          { error: `reply_text too long (max ${REPLY_MAX_LEN} chars)` },
          { status: 400 }
        );
      }
      updates.reply_text = trimmed;
    }
    if (typeof body.is_active === "boolean") {
      updates.is_active = body.is_active;
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "nothing to update" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data: row, error: updateErr } = await admin
      .from("comment_reply_templates")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, reply_text, is_active, created_at")
      .maybeSingle();

    if (updateErr) {
      return NextResponse.json(
        { error: `Failed to update reply: ${updateErr.message}` },
        { status: 500 }
      );
    }
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, template: row });
  } catch (err) {
    console.error("[comment-reply-templates] PATCH error:", err);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { user, errorResponse } = await authorize();
    if (errorResponse) return errorResponse;

    const body = await request.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { error: deleteErr } = await admin
      .from("comment_reply_templates")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (deleteErr) {
      return NextResponse.json(
        { error: `Failed to delete reply: ${deleteErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[comment-reply-templates] DELETE error:", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
