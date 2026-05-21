import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canUseVoiceReplies } from "@/lib/plan";
import { getSignedPlaybackUrl } from "@/lib/voice/snippets";

export async function GET(_request, { params }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, email, plan, subscription_status")
    .eq("id", user.id)
    .maybeSingle();

  if (!canUseVoiceReplies(profile)) {
    return NextResponse.json({ error: "upgrade_required" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const url = await getSignedPlaybackUrl(user.id, id, 300);
    return NextResponse.json({ url, expiresInSec: 300 });
  } catch (err) {
    if (err?.status === 404) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    console.error("[voice-snippets/[id]/playback-url:GET] error:", err?.message);
    return NextResponse.json({ error: "Failed to sign playback URL" }, { status: 500 });
  }
}
