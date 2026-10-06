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

/**
 * The holding text for an account. One constant today; this is the seam for
 * per-account overrides (Mara Rue accounts) later.
 *
 * @param {object} [_user]
 * @returns {string}
 */
export function holdingTextFor(_user) {
  return HANDOFF_HOLDING_TEXT;
}

// Fail-safe detection. Anything that looks like a marker is a handoff:
//   <<HANDOFF:medical_question>> alone, mixed into text, lowercased, with
//   spaces, malformed (<<HANDOFF>>, <<HANDOFF: medical>>), or the bare
//   snake_case category tokens, which never occur in a real DM.
const MARKER_RE = /<<\s*hand\s*_?\s*off\b[^>]*>{0,2}/i;
const LOOSE_RE = /\bhandoff\s*:\s*[a-z_]+/i;
const TOKEN_RE = /\b(medical_question|missing_knowledge)\b/i;

/**
 * @param {string} text - raw model output
 * @returns {{category: string, malformed: boolean} | null} null when the
 *   reply contains no marker. An unrecognized category defaults to
 *   missing_knowledge (the holding text is identical either way).
 */
export function detectHandoff(text) {
  const s = String(text ?? "");
  const hit = s.match(MARKER_RE) || s.match(LOOSE_RE) || s.match(TOKEN_RE);
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
