import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canUseCommentToDM } from "@/lib/comment-to-dm-gate";
import { DEFAULT_ACTIONS_PER_CLASS } from "@/lib/comment-trigger-rules";

// POST /api/settings/dm-templates
// Body: { intent_class, template }
//
// Upserts a single row in dm_templates keyed on (creator_id, intent_class).
// intent_class is validated against DEFAULT_ACTIONS_PER_CLASS's keys so the
// dm_templates table stays in lockstep with the classifier taxonomy without
// a separate enum. Body trimmed to 1500 chars (Meta's IG DM cap is 1000;
// we leave headroom for the placeholders).

const VALID_CLASSES = new Set(Object.keys(DEFAULT_ACTIONS_PER_CLASS));
const TEMPLATE_MAX_LEN = 1500;

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
    const intentClass =
      typeof body.intent_class === "string" ? body.intent_class.trim() : "";
    const templateRaw =
      typeof body.template === "string" ? body.template : "";

    if (!VALID_CLASSES.has(intentClass)) {
      return NextResponse.json(
        { error: "intent_class is invalid" },
        { status: 400 }
      );
    }

    const trimmed = templateRaw.trim();
    if (trimmed.length > TEMPLATE_MAX_LEN) {
      return NextResponse.json(
        { error: `template too long (max ${TEMPLATE_MAX_LEN} chars)` },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    if (!trimmed) {
      // Empty body == delete the row, so decideAction falls back to the
      // default (which for non-DM classes is ignore/queue_review).
      const { error: deleteErr } = await admin
        .from("dm_templates")
        .delete()
        .eq("creator_id", user.id)
        .eq("intent_class", intentClass);
      if (deleteErr) {
        return NextResponse.json(
          { error: `Failed to clear template: ${deleteErr.message}` },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: true, intent_class: intentClass, template: null });
    }

    const { data: existing } = await admin
      .from("dm_templates")
      .select("id")
      .eq("creator_id", user.id)
      .eq("intent_class", intentClass)
      .maybeSingle();

    if (existing) {
      const { error: updateErr } = await admin
        .from("dm_templates")
        .update({
          template: trimmed,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .eq("creator_id", user.id);
      if (updateErr) {
        return NextResponse.json(
          { error: `Failed to update template: ${updateErr.message}` },
          { status: 500 }
        );
      }
    } else {
      const { error: insertErr } = await admin
        .from("dm_templates")
        .insert({
          creator_id: user.id,
          intent_class: intentClass,
          template: trimmed,
        });
      if (insertErr) {
        return NextResponse.json(
          { error: `Failed to create template: ${insertErr.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      intent_class: intentClass,
      template: trimmed,
    });
  } catch (err) {
    console.error("[dm-templates] error:", err);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}
