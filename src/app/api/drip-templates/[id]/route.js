import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canUseDripSequences } from "@/lib/plan";
import { enforceAiRateLimit } from "@/lib/rate-limit";
import { updateDripTemplate, deleteDripTemplate } from "@/lib/drip/templates";

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

export async function PATCH(request, { params }) {
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

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const patch = {};
  if (body.content !== undefined) {
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (content.length < MIN_CONTENT_LEN || content.length > MAX_CONTENT_LEN) {
      return NextResponse.json({ error: "invalid_content" }, { status: 400 });
    }
    patch.content = content;
  }
  if (body.label !== undefined) {
    const label = typeof body.label === "string" ? body.label.trim() : "";
    if (!label || label.length > MAX_LABEL_LEN) {
      return NextResponse.json({ error: "invalid_label" }, { status: 400 });
    }
    patch.label = label;
  }
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") {
      return NextResponse.json({ error: "invalid_isActive" }, { status: 400 });
    }
    patch.isActive = body.isActive;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }

  try {
    const template = await updateDripTemplate(user.id, id, patch);
    return NextResponse.json({ template });
  } catch (err) {
    if (err?.status === 404) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (err?.status === 409) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("[drip-templates/[id]:PATCH] error:", err?.message);
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  const { user, profile } = await authedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canUseDripSequences(profile)) {
    return NextResponse.json({ error: "upgrade_required" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await deleteDripTemplate(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err?.status === 404) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    console.error("[drip-templates/[id]:DELETE] error:", err?.message);
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
  }
}
