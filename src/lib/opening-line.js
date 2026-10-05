// Leaf module, no imports. The opening line is script_config.greeting.
//
// The webhook holds every inbound lead (greeting_not_configured) until one
// exists, so the AI must never be on without it: /api/users/ai-mode checks
// it, the users table trigger (migration 20261005150000) enforces it for
// every browser write, and these helpers drive the UI. Zod is not a
// dependency of this project (and new dependencies are out), so the rule
// is written out here: trimmed, non-empty, at most 1,000 characters
// (Instagram's text DM limit; the trigger uses the same number).

export const OPENING_LINE_MAX = 1000;

/**
 * @param {unknown} raw
 * @returns {{ok: true, value: string} | {ok: false, error: string}}
 */
export function validateOpeningLine(raw) {
  if (typeof raw !== "string") return { ok: false, error: "Add an opening line first." };
  const value = raw.trim();
  if (!value) return { ok: false, error: "Add an opening line first." };
  if (value.length > OPENING_LINE_MAX) {
    return { ok: false, error: `Keep the opening line under ${OPENING_LINE_MAX} characters.` };
  }
  return { ok: true, value };
}

/** True when script_config holds a valid opening line. */
export function hasOpeningLine(scriptConfig) {
  return validateOpeningLine(scriptConfig?.greeting).ok;
}

// The users-table trigger (migration 20261005150000) raises errors whose
// message starts with this prefix. Browser saves map them to plain copy.
export const OPENING_LINE_DB_ERROR_PREFIX = "opening_line_required";

/** Plain-language copy for a trigger rejection, or null if it isn't one. */
export function openingLineDbErrorMessage(err) {
  const msg = typeof err?.message === "string" ? err.message : "";
  if (!msg.startsWith(OPENING_LINE_DB_ERROR_PREFIX)) return null;
  if (msg.includes("too_long")) {
    return `Keep the opening line under ${OPENING_LINE_MAX} characters.`;
  }
  return "Your AI is on, so it needs an opening line. Add one, or switch the AI to Handoff first.";
}
