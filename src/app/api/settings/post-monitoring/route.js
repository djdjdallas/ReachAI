import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canUseCommentToDM } from "@/lib/comment-to-dm-gate";
import { ACTIONS, DEFAULT_ACTIONS_PER_CLASS } from "@/lib/comment-trigger-rules";

// POST /api/settings/post-monitoring
// Body: { ig_media_id, enabled, actions_per_class? }
//
// Upserts a row in post_monitoring_settings keyed on (creator_id, post_id).
// The `posts` row is upserted from ig_media_id+caption+permalink so the
// coach can opt-in to monitoring before any comment webhook arrives. RLS
// already scopes writes to auth.uid() = creator_id; we double-check the
// gate + creator_id server-side as defense-in-depth.

const VALID_ACTIONS = new Set(Object.values(ACTIONS));
const VALID_CLASSES = new Set(Object.keys(DEFAULT_ACTIONS_PER_CLASS));

function sanitizeActionsPerClass(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const out = {};
  for (const [cls, action] of Object.entries(input)) {
    if (!VALID_CLASSES.has(cls)) continue;
    if (typeof action !== "string" || !VALID_ACTIONS.has(action)) continue;
    out[cls] = action;
  }
  return Object.keys(out).length ? out : null;
}

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
    const igMediaId =
      typeof body.ig_media_id === "string" && body.ig_media_id.trim()
        ? body.ig_media_id.trim()
        : null;
    if (!igMediaId) {
      return NextResponse.json(
        { error: "ig_media_id is required" },
        { status: 400 }
      );
    }
    const enabled = body.enabled !== false;
    const actionsPerClass = sanitizeActionsPerClass(body.actions_per_class);
    const caption =
      typeof body.caption === "string" ? body.caption.slice(0, 4000) : null;
    const permalink =
      typeof body.permalink === "string" ? body.permalink.slice(0, 1000) : null;
    const mediaType =
      typeof body.media_type === "string" ? body.media_type.slice(0, 32) : null;

    const admin = getSupabaseAdmin();

    // Upsert the posts row first so the FK target exists.
    const { data: existingPost } = await admin
      .from("posts")
      .select("id")
      .eq("ig_media_id", igMediaId)
      .maybeSingle();

    let postId = existingPost?.id || null;
    if (!postId) {
      const { data: inserted, error: insertErr } = await admin
        .from("posts")
        .insert({
          creator_id: user.id,
          ig_media_id: igMediaId,
          media_type: mediaType,
          caption,
          permalink,
          posted_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (insertErr) {
        return NextResponse.json(
          { error: `Failed to register post: ${insertErr.message}` },
          { status: 500 }
        );
      }
      postId = inserted.id;
    } else if (caption || permalink || mediaType) {
      // Best-effort: keep posts metadata fresh, but don't fail the request
      // if it doesn't land.
      await admin
        .from("posts")
        .update({
          ...(caption ? { caption } : {}),
          ...(permalink ? { permalink } : {}),
          ...(mediaType ? { media_type: mediaType } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", postId)
        .eq("creator_id", user.id);
    }

    // Now upsert the monitoring row. Manual select-then-insert/update so we
    // can honor RLS via the admin client without needing ON CONFLICT.
    const { data: existingMonitor } = await admin
      .from("post_monitoring_settings")
      .select("id")
      .eq("creator_id", user.id)
      .eq("post_id", postId)
      .maybeSingle();

    if (existingMonitor) {
      const { error: updateErr } = await admin
        .from("post_monitoring_settings")
        .update({
          enabled,
          actions_per_class: actionsPerClass,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingMonitor.id)
        .eq("creator_id", user.id);
      if (updateErr) {
        return NextResponse.json(
          { error: `Failed to update monitor row: ${updateErr.message}` },
          { status: 500 }
        );
      }
    } else {
      const { error: insertErr } = await admin
        .from("post_monitoring_settings")
        .insert({
          creator_id: user.id,
          post_id: postId,
          enabled,
          actions_per_class: actionsPerClass,
        });
      if (insertErr) {
        return NextResponse.json(
          { error: `Failed to create monitor row: ${insertErr.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      post_id: postId,
      enabled,
      actions_per_class: actionsPerClass,
    });
  } catch (err) {
    console.error("[post-monitoring] error:", err);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}
