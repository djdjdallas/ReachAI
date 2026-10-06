// Renders a coach's enabled knowledge entries as the <business_knowledge>
// block of the reply system prompt. Leaf module (imports limits only).
//
// Owner text is untrusted input: it is XML-escaped so an entry can never
// close the block or open a fake tag, and the block sits after the system
// rules (see buildSystemPrompt). Output is deterministic for the same rows
// (stable order, no timestamps) so the prompt prefix stays byte-identical
// between edits.

import { BLOCK_OVERHEAD, KNOWLEDGE_TOTAL_CAP, entryChars, renderEntry } from "./limits";

function byOrder(a, b) {
  const s = (a.sort ?? 0) - (b.sort ?? 0);
  if (s) return s;
  const c = String(a.created_at || "").localeCompare(String(b.created_at || ""));
  if (c) return c;
  return String(a.id || "").localeCompare(String(b.id || ""));
}

/**
 * Enabled, non-empty entries in prompt order, cut off at the total cap. The
 * API route enforces the cap on write; this second cut means a race between
 * two writes can never put more than the cap into a prompt.
 *
 * @param {Array<object>} entries
 * @returns {Array<object>}
 */
export function promptEntries(entries) {
  const out = [];
  let used = BLOCK_OVERHEAD;
  for (const e of [...(entries || [])].filter((e) => e?.enabled).sort(byOrder)) {
    const answer = (e.answer || "").trim();
    if (!answer) continue;
    const cost = entryChars(e);
    if (used + cost > KNOWLEDGE_TOTAL_CAP) break;
    used += cost;
    out.push(e);
  }
  return out;
}

/**
 * @param {Array<object>} entries - knowledge_entries rows
 * @returns {string} the block, or "" when no entry qualifies
 */
export function formatBusinessKnowledge(entries) {
  const rows = promptEntries(entries);
  if (!rows.length) return "";
  const body = rows.map(renderEntry).join("\n");
  return `<business_knowledge>\n${body}\n</business_knowledge>`;
}
