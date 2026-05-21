import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canUseVoiceReplies } from "@/lib/plan";
import { enforceAiRateLimit } from "@/lib/rate-limit";

const ALLOWED_EXTENSIONS = new Set(["mp3", "m4a", "wav", "ogg"]);
const BUCKET = "voice-snippets";

export async function POST(request) {
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

  const admin = getSupabaseAdmin();
  const limited = await enforceAiRateLimit(admin, user.id, "voice_upload_url", 30);
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const extension =
    typeof body.extension === "string" ? body.extension.toLowerCase().trim() : "";
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return NextResponse.json({ error: "invalid_extension" }, { status: 400 });
  }

  const fileId = crypto.randomUUID();
  const storagePath = `${user.id}/${fileId}.${extension}`;

  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error || !data?.signedUrl) {
    console.error("[voice-snippets/upload-url:POST] sign failed:", error?.message);
    return NextResponse.json(
      { error: "Failed to create upload URL" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    storagePath,
    signedUrl: data.signedUrl,
    token: data.token,
  });
}
