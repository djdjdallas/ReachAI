import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isIntentClassifierEnabled } from "@/lib/featureFlags";

const VALID_FEEDBACK = new Set(["thumbs_up", "thumbs_down"]);

// POST /api/admin/classify/feedback
// Body: { classificationId, feedback: 'thumbs_up'|'thumbs_down', correctClass?, notes? }
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

    if (!isIntentClassifierEnabled(user.email)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const { classificationId, feedback, correctClass, notes } = body;

    if (!classificationId || !VALID_FEEDBACK.has(feedback)) {
      return NextResponse.json(
        { error: "classificationId and a valid feedback value are required" },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    const { data: classification, error: lookupErr } = await admin
      .from("comment_classifications")
      .select("id, creator_id")
      .eq("id", classificationId)
      .maybeSingle();

    if (lookupErr || !classification) {
      return NextResponse.json(
        { error: "Classification not found" },
        { status: 404 }
      );
    }

    if (classification.creator_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: inserted, error: insertErr } = await admin
      .from("classifier_feedback")
      .insert({
        classification_id: classificationId,
        creator_id: user.id,
        feedback,
        correct_class:
          typeof correctClass === "string" && correctClass ? correctClass : null,
        notes: typeof notes === "string" && notes ? notes : null,
      })
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json(
        { error: `Failed to record feedback: ${insertErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ feedbackId: inserted.id });
  } catch (err) {
    console.error("Admin feedback error:", err);
    return NextResponse.json(
      { error: "Failed to record feedback." },
      { status: 500 }
    );
  }
}
