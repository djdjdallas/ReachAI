import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canUseVoiceReplies } from "@/lib/plan";
import {
  toggleVoiceSnippet,
  deleteVoiceSnippet,
} from "@/lib/voice/snippets";

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
  if (!canUseVoiceReplies(profile)) {
    return NextResponse.json({ error: "upgrade_required" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (typeof body.isActive !== "boolean") {
    return NextResponse.json({ error: "invalid_isActive" }, { status: 400 });
  }

  try {
    const snippet = await toggleVoiceSnippet(user.id, id, body.isActive);
    return NextResponse.json({ snippet });
  } catch (err) {
    if (err?.status === 404) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    console.error("[voice-snippets/[id]:PATCH] error:", err?.message);
    return NextResponse.json({ error: "Failed to update snippet" }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  const { user, profile } = await authedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canUseVoiceReplies(profile)) {
    return NextResponse.json({ error: "upgrade_required" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await deleteVoiceSnippet(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err?.status === 404) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    console.error("[voice-snippets/[id]:DELETE] error:", err?.message);
    return NextResponse.json({ error: "Failed to delete snippet" }, { status: 500 });
  }
}
