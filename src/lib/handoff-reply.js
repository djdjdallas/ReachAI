// Knowledge handoff: the marker the reply model emits when it must not
// answer, and the fixed holding text the lead gets instead. Leaf module, no
// imports (the settings page, prompts.js, reply-lint.js and every reply path
// read it).
//
// The model never writes the holding reply itself. On a medical question a
// model-written "let me check" can carry half an answer ("usually it's fine,
// but let me check"), so the server sends this constant and discards
// whatever the model wrote.

export const HANDOFF_CATEGORIES = ["medical_question", "missing_knowledge"];

// Exact strings the system prompt tells the model to output. prompts.js
// quotes these, so they must come from here.
export const HANDOFF_MARKERS = {
  medical_question: "<<HANDOFF:medical_question>>",
  missing_knowledge: "<<HANDOFF:missing_knowledge>>",
};

// Approved wording (2026-10-05). No "team" (the identity rules forbid
// inventing one) and no em dash. Never run through lintReply: its filler-
// opener rule would strip "Good question,".
export const HANDOFF_HOLDING_TEXT =
  "Good question, let me check on that and get back to you.";

// Bounds for a per-account override (users.holding_text, set by the admin
// script after src/lib/persona.js validateHoldingText). Re-checked here at
// send time so a bad row falls back to the default instead of sending.
const HOLDING_TEXT_MAX = 300;
const HOLDING_TEXT_FORBIDDEN = /[\u2013\u2014]|\{\{|<<|>>|\bhandoff\b/i;

/**
 * The holding text for an account: users.holding_text when it is set and
 * safe, otherwise the default.
 *
 * @param {{holding_text?: string|null}} [user]
 * @returns {string}
 */
export function holdingTextFor(user) {
  const custom = typeof user?.holding_text === "string" ? user.holding_text.trim() : "";
  if (custom && custom.length <= HOLDING_TEXT_MAX && !HOLDING_TEXT_FORBIDDEN.test(custom)) {
    return custom;
  }
  return HANDOFF_HOLDING_TEXT;
}

// Fail-safe detection. Anything that looks like a marker is a handoff:
//   <<HANDOFF:medical_question>> alone, mixed into text, lowercased, with
//   spaces, malformed (<<HANDOFF>>, <<HANDOFF: medical>>), or HANDOFF:<word>
//   without the brackets. The bare category words (medical_question,
//   missing_knowledge) are NOT a marker on their own: a lead could otherwise
//   pause a thread by asking the model to repeat a word.
const MARKER_RE = /<<\s*hand\s*_?\s*off\b[^>]*>{0,2}/i;
const LOOSE_RE = /\bhandoff\s*:\s*[a-z_]+/i;

/**
 * @param {string} text - raw model output
 * @returns {{category: string, malformed: boolean} | null} null when the
 *   reply contains no marker. An unrecognized category defaults to
 *   missing_knowledge (the holding text is identical either way).
 */
export function detectHandoff(text) {
  const s = String(text ?? "");
  const hit = s.match(MARKER_RE) || s.match(LOOSE_RE);
  if (!hit) return null;
  const around = hit[0].toLowerCase();
  const category = around.includes("medical")
    ? "medical_question"
    : around.includes("missing_knowledge")
      ? "missing_knowledge"
      : null;
  const exact = Object.values(HANDOFF_MARKERS).includes(s.trim());
  return {
    category: category || "missing_knowledge",
    malformed: !exact,
  };
}
