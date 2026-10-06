// Business knowledge limits and validation. Leaf module, no imports: the
// settings page (browser) uses it for the character meter and the API route
// (server) uses it to enforce the same numbers. The DB CHECKs in migration
// 20261008120000_knowledge_entries.sql mirror the per-field limits.
//
// No RAG: every enabled entry goes into the system prompt, so the cap is the
// whole design. ~15k chars is ~3.75k tokens on every reply.

export const KNOWLEDGE_TYPES = ["faq", "policy", "note"];

export const KNOWLEDGE_TOTAL_CAP = 15_000;
export const QUESTION_MAX = 300;
export const ANSWER_MAX = 2_000;
export const MAX_ENTRIES = 100;

/**
 * Characters an entry costs against the cap. Only enabled entries reach the
 * prompt, so only they count.
 *
 * @param {{question?: string, answer?: string, enabled?: boolean}} entry
 * @returns {number}
 */
export function entryChars(entry) {
  if (!entry?.enabled) return 0;
  return (entry.question || "").length + (entry.answer || "").length;
}

/**
 * @param {Array<object>} entries
 * @returns {number}
 */
export function totalChars(entries) {
  return (entries || []).reduce((sum, e) => sum + entryChars(e), 0);
}

/**
 * Validates and normalizes one entry's fields. `partial` validates only the
 * fields present (PATCH). Returns the trimmed values or the first error.
 *
 * Rules: type in KNOWLEDGE_TYPES; question <= QUESTION_MAX (optional for
 * notes, required for faq/policy when enabled); answer <= ANSWER_MAX and
 * non-empty when enabled. A disabled entry may be an empty draft (that is
 * what the starter templates create).
 *
 * @param {object} input
 * @param {{partial?: boolean, current?: object}} [opts] - current: the stored
 *   row a PATCH applies to, so cross-field rules see the merged result
 * @returns {{ok: true, value: object} | {ok: false, error: string}}
 */
export function validateEntry(input, { partial = false, current = null } = {}) {
  const src = input && typeof input === "object" ? input : {};
  const value = {};

  if (!partial || "type" in src) {
    if (!KNOWLEDGE_TYPES.includes(src.type)) {
      return { ok: false, error: `type must be one of ${KNOWLEDGE_TYPES.join(", ")}` };
    }
    value.type = src.type;
  }
  if (!partial || "question" in src) {
    if (src.question != null && typeof src.question !== "string") {
      return { ok: false, error: "question must be text" };
    }
    value.question = (src.question || "").trim();
    if (value.question.length > QUESTION_MAX) {
      return { ok: false, error: `question is over ${QUESTION_MAX} characters` };
    }
  }
  if (!partial || "answer" in src) {
    if (src.answer != null && typeof src.answer !== "string") {
      return { ok: false, error: "answer must be text" };
    }
    value.answer = (src.answer || "").trim();
    if (value.answer.length > ANSWER_MAX) {
      return { ok: false, error: `answer is over ${ANSWER_MAX} characters` };
    }
  }
  if (!partial || "enabled" in src) {
    if (src.enabled != null && typeof src.enabled !== "boolean") {
      return { ok: false, error: "enabled must be true or false" };
    }
    value.enabled = src.enabled === true;
  }
  if ("sort" in src) {
    if (!Number.isInteger(src.sort) || src.sort < 0 || src.sort > 10_000) {
      return { ok: false, error: "sort must be a whole number" };
    }
    value.sort = src.sort;
  }

  const merged = { ...(current || {}), ...value };
  if (merged.enabled) {
    if (!merged.answer) {
      return { ok: false, error: "Add an answer before turning this entry on" };
    }
    if (merged.type !== "note" && !merged.question) {
      return { ok: false, error: "Add a question before turning this entry on" };
    }
  }
  return { ok: true, value };
}
