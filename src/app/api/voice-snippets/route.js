import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canUseVoiceReplies } from "@/lib/plan";
import { VOICE_ELIGIBLE_CLASSES } from "@/lib/dm-intent";
import {
  listVoiceSnippets,
  createVoiceSnippet,
} from "@/lib/voice/snippets";

const VOICE_ELIGIBLE_CLASS_SET = new Set(VOICE_ELIGIBLE_CLASSES);

const ALLOWED_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/ogg",
  "audio/x-m4a",
  "audio/aac",
]);

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_DURATION_MS = 90_000;
const MAX_LABEL_LEN = 80;
const MAX_TRANSCRIPT_LEN = 2000;

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
  if (!canUseVoiceReplies(profile)) {
    return NextResponse.json({ error: "upgrade_required" }, { status: 403 });
  }

  try {
    const snippets = await listVoiceSnippets(user.id);
    return NextResponse.json({ snippets });
  } catch (err) {
    console.error("[voice-snippets:GET] error:", err?.message);
    return NextResponse.json({ error: "Failed to list snippets" }, { status: 500 });
  }
}

export async function POST(request) {
  const { user, profile } = await authedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canUseVoiceReplies(profile)) {
    return NextResponse.json({ error: "upgrade_required" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));

  const intentClass = typeof body.intentClass === "string" ? body.intentClass.trim() : "";
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const storagePath = typeof body.storagePath === "string" ? body.storagePath.trim() : "";
  const durationMs = Number(body.durationMs);
  const mimeType = typeof body.mimeType === "string" ? body.mimeType.trim() : "";
  const fileSizeBytes = Number(body.fileSizeBytes);
  const transcript =
    typeof body.transcript === "string" ? body.transcript.trim() : "";
  const consentConfirmed = body.consentConfirmed === true;

  if (!consentConfirmed) {
    return NextResponse.json({ error: "consent_required" }, { status: 400 });
  }

  if (!VOICE_ELIGIBLE_CLASS_SET.has(intentClass)) {
    return NextResponse.json({ error: "invalid_intent_class" }, { status: 400 });
  }

  if (!label || label.length > MAX_LABEL_LEN) {
    return NextResponse.json({ error: "invalid_label" }, { status: 400 });
  }

  if (!storagePath.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "invalid_storage_path" }, { status: 400 });
  }

  if (!Number.isFinite(durationMs) || durationMs < 0 || durationMs > MAX_DURATION_MS) {
    return NextResponse.json({ error: "invalid_duration" }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return NextResponse.json({ error: "invalid_mime_type" }, { status: 400 });
  }

  if (
    !Number.isFinite(fileSizeBytes) ||
    fileSizeBytes <= 0 ||
    fileSizeBytes > MAX_FILE_BYTES
  ) {
    return NextResponse.json({ error: "invalid_file_size" }, { status: 400 });
  }

  if (transcript && transcript.length > MAX_TRANSCRIPT_LEN) {
    return NextResponse.json({ error: "transcript_too_long" }, { status: 400 });
  }

  try {
    const snippet = await createVoiceSnippet({
      userId: user.id,
      intentClass,
      label,
      storagePath,
      durationMs: Math.round(durationMs),
      mimeType,
      fileSizeBytes: Math.round(fileSizeBytes),
      transcript: transcript || null,
    });
    return NextResponse.json({ snippet });
  } catch (err) {
    if (err?.code === "file_missing") {
      return NextResponse.json(
        {
          error: "file_missing",
          message: "Audio file not found in storage. Re-upload and try again.",
        },
        { status: 400 }
      );
    }
    if (err?.status === 409) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("[voice-snippets:POST] error:", err?.message);
    return NextResponse.json({ error: "Failed to create snippet" }, { status: 500 });
  }
}
