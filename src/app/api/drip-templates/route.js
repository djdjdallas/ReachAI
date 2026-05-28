import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canUseDripSequences } from "@/lib/plan";
import { VOICE_ELIGIBLE_CLASSES } from "@/lib/dm-intent";
import { enforceAiRateLimit } from "@/lib/rate-limit";
import { listDripTemplates, createDripTemplate } from "@/lib/drip/templates";

const ELIGIBLE_CLASS_SET = new Set(VOICE_ELIGIBLE_CLASSES);
const MAX_LABEL_LEN = 80;
const MIN_CONTENT_LEN = 10;
const MAX_CONTENT_LEN = 1000;

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

export async function GET() {
  const { user, profile } = await authedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canUseDripSequences(profile)) {
    return NextResponse.json({ error: "upgrade_required" }, { status: 403 });
  }

  try {
    const templates = await listDripTemplates(user.id);
    return NextResponse.json({ templates });
  } catch (err) {
    console.error("[drip-templates:GET] error:", err?.message);
    return NextResponse.json({ error: "Failed to list templates" }, { status: 500 });
  }
}

export async function POST(request) {
  const { user, profile } = await authedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canUseDripSequences(profile)) {
    return NextResponse.json({ error: "upgrade_required" }, { status: 403 });
  }

  const limited = await enforceAiRateLimit(
    getSupabaseAdmin(),
    user.id,
    "drip-templates",
    30
  );
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const intentClass =
    typeof body.intentClass === "string" ? body.intentClass.trim() : "";
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";

  if (!ELIGIBLE_CLASS_SET.has(intentClass)) {
    return NextResponse.json({ error: "invalid_intent_class" }, { status: 400 });
  }
  if (!label || label.length > MAX_LABEL_LEN) {
    return NextResponse.json({ error: "invalid_label" }, { status: 400 });
  }
  if (content.length < MIN_CONTENT_LEN || content.length > MAX_CONTENT_LEN) {
    return NextResponse.json({ error: "invalid_content" }, { status: 400 });
  }

  try {
    const template = await createDripTemplate({
      userId: user.id,
      intentClass,
      label,
      content,
    });
    return NextResponse.json({ template });
  } catch (err) {
    if (err?.status === 409) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("[drip-templates:POST] error:", err?.message);
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }
}
