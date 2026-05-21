import { getSupabaseAdmin } from "@/lib/supabase/admin";

const BUCKET = "voice-snippets";

/**
 * Lists all voice snippets owned by a user, newest first.
 */
export async function listVoiceSnippets(userId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("voice_snippets")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`listVoiceSnippets failed: ${error.message}`);
  }
  return data || [];
}

/**
 * Creates a new voice snippet row and atomically deactivates any other
 * active snippet for the same (user_id, intent_class).
 *
 * The partial unique index `voice_snippets_active_per_class` enforces the
 * "only one active per class" invariant at the DB level. We deactivate
 * the existing active row first so the insert doesn't race; if a race
 * happens anyway, the unique index will reject the insert and the caller
 * surfaces a 409.
 */
export async function createVoiceSnippet({
  userId,
  intentClass,
  label,
  storagePath,
  durationMs,
  mimeType,
  fileSizeBytes,
  transcript,
}) {
  const supabase = getSupabaseAdmin();

  // Verify the file actually exists in storage. Blocks orphan-pointer
  // rows from clients that bypass the upload-url → PUT → POST sequence,
  // and surfaces a clean error if the PUT silently failed mid-flight.
  const lastSlash = storagePath.lastIndexOf("/");
  const folderPath = lastSlash >= 0 ? storagePath.slice(0, lastSlash) : "";
  const filename = lastSlash >= 0 ? storagePath.slice(lastSlash + 1) : storagePath;
  const { data: existing, error: listErr } = await supabase.storage
    .from(BUCKET)
    .list(folderPath, { search: filename });

  if (listErr) {
    throw new Error(`storage_check_failed: ${listErr.message}`);
  }
  if (!Array.isArray(existing) || !existing.some((row) => row.name === filename)) {
    const missing = new Error("file_missing");
    missing.code = "file_missing";
    throw missing;
  }

  const { error: deactivateErr } = await supabase
    .from("voice_snippets")
    .update({ is_active: false })
    .eq("user_id", userId)
    .eq("intent_class", intentClass)
    .eq("is_active", true);

  if (deactivateErr) {
    throw new Error(
      `createVoiceSnippet deactivate-existing failed: ${deactivateErr.message}`
    );
  }

  const { data, error } = await supabase
    .from("voice_snippets")
    .insert({
      user_id: userId,
      intent_class: intentClass,
      label,
      storage_path: storagePath,
      duration_ms: durationMs,
      mime_type: mimeType,
      file_size_bytes: fileSizeBytes,
      transcript: transcript || null,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    const isUniqueConflict =
      error.code === "23505" ||
      (typeof error.message === "string" &&
        error.message.includes("voice_snippets_active_per_class"));
    if (isUniqueConflict) {
      const conflict = new Error(
        "Another active snippet exists for this intent. Retry after deactivating it."
      );
      conflict.status = 409;
      throw conflict;
    }
    throw new Error(`createVoiceSnippet insert failed: ${error.message}`);
  }

  return data;
}

/**
 * Toggles a snippet's is_active flag. When activating, deactivates any other
 * active snippet for the same (user_id, intent_class).
 */
export async function toggleVoiceSnippet(userId, snippetId, isActive) {
  const supabase = getSupabaseAdmin();

  const { data: snippet, error: lookupErr } = await supabase
    .from("voice_snippets")
    .select("*")
    .eq("id", snippetId)
    .eq("user_id", userId)
    .maybeSingle();

  if (lookupErr) {
    throw new Error(`toggleVoiceSnippet lookup failed: ${lookupErr.message}`);
  }
  if (!snippet) {
    const notFound = new Error("Snippet not found");
    notFound.status = 404;
    throw notFound;
  }

  if (isActive) {
    const { error: deactivateErr } = await supabase
      .from("voice_snippets")
      .update({ is_active: false })
      .eq("user_id", userId)
      .eq("intent_class", snippet.intent_class)
      .eq("is_active", true)
      .neq("id", snippetId);
    if (deactivateErr) {
      throw new Error(
        `toggleVoiceSnippet deactivate-siblings failed: ${deactivateErr.message}`
      );
    }
  }

  const { data, error } = await supabase
    .from("voice_snippets")
    .update({ is_active: !!isActive })
    .eq("id", snippetId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    throw new Error(`toggleVoiceSnippet update failed: ${error.message}`);
  }
  return data;
}

/**
 * Deletes a snippet row AND its file in storage.
 *
 * Storage removal is best-effort: a successful row delete with a failed
 * file delete just leaves an orphan blob, which is preferable to leaving
 * a row pointing at a missing file (the matcher would 404 at send time).
 */
export async function deleteVoiceSnippet(userId, snippetId) {
  const supabase = getSupabaseAdmin();

  const { data: snippet, error: lookupErr } = await supabase
    .from("voice_snippets")
    .select("storage_path, user_id")
    .eq("id", snippetId)
    .eq("user_id", userId)
    .maybeSingle();

  if (lookupErr) {
    throw new Error(`deleteVoiceSnippet lookup failed: ${lookupErr.message}`);
  }
  if (!snippet) {
    const notFound = new Error("Snippet not found");
    notFound.status = 404;
    throw notFound;
  }

  const { error: deleteRowErr } = await supabase
    .from("voice_snippets")
    .delete()
    .eq("id", snippetId)
    .eq("user_id", userId);

  if (deleteRowErr) {
    throw new Error(`deleteVoiceSnippet row delete failed: ${deleteRowErr.message}`);
  }

  if (snippet.storage_path) {
    const { error: storageErr } = await supabase.storage
      .from(BUCKET)
      .remove([snippet.storage_path]);
    if (storageErr) {
      console.warn(
        `[voice/snippets] storage remove failed for ${snippet.storage_path}:`,
        storageErr.message
      );
    }
  }

  return { id: snippetId };
}

/**
 * Returns a signed playback URL for in-dashboard preview.
 * Default TTL: 5 minutes — enough for a coach to click play.
 */
export async function getSignedPlaybackUrl(userId, snippetId, expiresInSec = 300) {
  const supabase = getSupabaseAdmin();

  const { data: snippet, error: lookupErr } = await supabase
    .from("voice_snippets")
    .select("storage_path")
    .eq("id", snippetId)
    .eq("user_id", userId)
    .maybeSingle();

  if (lookupErr) {
    throw new Error(`getSignedPlaybackUrl lookup failed: ${lookupErr.message}`);
  }
  if (!snippet) {
    const notFound = new Error("Snippet not found");
    notFound.status = 404;
    throw notFound;
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(snippet.storage_path, expiresInSec);

  if (error || !data?.signedUrl) {
    throw new Error(
      `getSignedPlaybackUrl sign failed: ${error?.message || "no url returned"}`
    );
  }

  return data.signedUrl;
}
