import { getSupabaseAdmin } from "@/lib/supabase/admin";

const BUCKET = "voice-snippets";

/**
 * Resolves a (userId, intentClass) pair to an active voice snippet plus a
 * skip-reason. Always returns `{ snippet, reason }`:
 *
 *   - `{ snippet: <row>, reason: null }`              — proceed to send
 *   - `{ snippet: null,  reason: 'kill_switch' }`     — voice_replies_enabled is false
 *   - `{ snippet: null,  reason: 'do_not_send' }`     — hostile message; webhook pauses
 *   - `{ snippet: null,  reason: 'no_snippet' }`      — no active snippet for that class
 *   - `{ snippet: null,  reason: 'lookup_error' }`    — Supabase error; fail-closed
 *
 * The matcher is intentionally side-effect-free: it does not log to
 * voice_send_log. The caller (the webhook) decides which skip reasons
 * are worth logging — 'kill_switch' is logged for Meta App Review
 * observability, 'no_snippet' is intentionally not logged (would be
 * noisy on every inbound DM from a coach who hasn't covered all
 * classes yet).
 *
 * @param {string} userId
 * @param {string} intentClass - one of the seven DM_INTENT_CLASSES
 * @returns {Promise<{snippet: object|null, reason: string|null}>}
 */
export async function findVoiceSnippetForIntent(userId, intentClass) {
  const supabase = getSupabaseAdmin();

  // FIRST CHECK: per-user kill switch. Done BEFORE the do_not_send check
  // so a disabled user never touches any other table.
  const { data: userRow, error: userErr } = await supabase
    .from("users")
    .select("voice_replies_enabled")
    .eq("id", userId)
    .maybeSingle();

  if (userErr) {
    console.warn(
      "[voice/matcher] kill-switch lookup failed; returning null:",
      userErr.message
    );
    return { snippet: null, reason: "lookup_error" };
  }
  if (!userRow || userRow.voice_replies_enabled === false) {
    return { snippet: null, reason: "kill_switch" };
  }

  // SECOND CHECK: do_not_send is never voice-replyable. Returned without
  // querying voice_snippets — the webhook handles the conversation pause.
  if (intentClass === "do_not_send") {
    return { snippet: null, reason: "do_not_send" };
  }

  const { data: snippet, error: snippetErr } = await supabase
    .from("voice_snippets")
    .select("*")
    .eq("user_id", userId)
    .eq("intent_class", intentClass)
    .eq("is_active", true)
    .maybeSingle();

  if (snippetErr) {
    console.warn(
      "[voice/matcher] snippet lookup failed; returning null:",
      snippetErr.message
    );
    return { snippet: null, reason: "lookup_error" };
  }

  if (!snippet) {
    return { snippet: null, reason: "no_snippet" };
  }
  return { snippet, reason: null };
}

/**
 * Returns a signed URL Meta can fetch the audio from. Meta retries on
 * transient failures so the floor here is 10 minutes — anything shorter
 * risks Meta hitting an expired URL on retry.
 *
 * @param {string} storagePath
 * @param {number} expiresInSec - default 600 (10 minutes)
 * @returns {Promise<string>}
 */
export async function getSendableAudioUrl(storagePath, expiresInSec = 600) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSec);
  if (error || !data?.signedUrl) {
    throw new Error(
      `getSendableAudioUrl failed for ${storagePath}: ${error?.message || "no url returned"}`
    );
  }
  return data.signedUrl;
}
