// Pre-send filter for AI-written DMs. Every reply path runs the model's text
// through lintReply() before it is saved or sent.
//
// Why: prompt rules alone did not hold. 28 of 30 prod replies in the 60 days
// before 2026-09-28 contained em dashes despite a "NO em dashes" rule
// (audits/dm-classifier-prompt-audit-2026-09-28.md P1-10). The rule from Dom:
// replies must never carry em dashes or other tells that a machine wrote them.
//
// Four outcomes:
//   fixes   — mechanical tells rewritten deterministically (dashes,
//             semicolons, ellipsis character, markdown, filler openers)
//   flags   — stock AI phrasing we can't safely rewrite; logged for
//             measurement, text left as-is
//   blocked — a leftover {{placeholder}}; sending it would be broken, so the
//             caller must not send
//   handoff — the model emitted a knowledge-handoff marker (well-formed,
//             mixed into text, or malformed). Also sets blocked. Callers
//             must check handoff FIRST and run the handoff path (fixed
//             holding text, pause, owner email): a marker is never a
//             silent drop and the model's text is never sent.
//
// The only import is handoff-reply.js, itself a leaf.

import { detectHandoff } from "./handoff-reply";

const FILLER_OPENERS = [
  /^(?:great|good|awesome|fair|love (?:this|that)) question[!.,]*\s+/i,
  /^(?:absolutely|certainly|of course|definitely)[!.,]+\s+/i,
];

// Flag-only: rewriting these mid-sentence would mangle grammar.
export const AI_TELL_PHRASES = [
  "i'd be happy to",
  "i would be happy to",
  "feel free to",
  "don't hesitate to",
  "rest assured",
  "i hope this helps",
  "i understand your concern",
  "great question",
  "delve",
  "diving into",
  "game-changer",
  "game changer",
  "leverage",
  "tailored",
  "comprehensive",
  "journey",
  "our team",
  "the team",
  "as an ai language model",
];

// Word ranges written with a dash ("Mon - Fri", "Jan – Mar", "9am - noon",
// "LA - NYC") are ranges, not asides: they must not become "Mon, Fri".
// Days and months are matched capitalized only ("you may - if" is not May).
const DAY_OR_MONTH =
  "(?:Mon|Tue|Tues|Wed|Thu|Thur|Thurs|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|" +
  "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December)";
const TIME = "(?:\\d{1,2}(?::\\d{2})?\\s?(?:[ap]\\.?m\\.?)|noon|midnight)";
// A hyphen with spaces around it, or an en/em dash with or without.
const RANGE_DASH = "(?:[ \\t]+-[ \\t]+|[ \\t]*[–—][ \\t]*)";
const DAY_MONTH_RANGE_RE = new RegExp(`\\b(${DAY_OR_MONTH})\\.?${RANGE_DASH}(${DAY_OR_MONTH})\\b`, "g");
const TIME_RANGE_RE = new RegExp(`(?<![\\w:])(${TIME})${RANGE_DASH}(${TIME})(?![\\w])`, "gi");
const ABBREV_RANGE_RE = new RegExp(`\\b([A-Z]{2,5})${RANGE_DASH}([A-Z]{2,5})\\b`, "g");

/** "Mon - Fri" → "Mon-Fri", "9am - noon" → "9am to noon", "LA - NYC" → "LA to NYC". */
export function normalizeWordRanges(text) {
  return String(text ?? "")
    .replace(DAY_MONTH_RANGE_RE, "$1-$2")
    .replace(TIME_RANGE_RE, "$1 to $2")
    .replace(ABBREV_RANGE_RE, "$1 to $2");
}

function capitalizeLike(original, text) {
  if (!text) return text;
  const wasUpper = /^[A-Z]/.test(original);
  return wasUpper ? text[0].toUpperCase() + text.slice(1) : text;
}

/**
 * @param {string} text - raw model output
 * @param {{bookingLink?: string}} [options]
 * @returns {{text: string, fixes: string[], flags: string[], blocked: boolean,
 *   handoff: {category: string, malformed: boolean} | null}}
 */
export function lintReply(text, { bookingLink = "" } = {}) {
  const fixes = [];
  const flags = [];
  let out = String(text ?? "").trim();

  const handoff = detectHandoff(out);
  if (handoff) {
    return { text: "", fixes, flags, blocked: true, handoff };
  }

  // Placeholders: fill the booking link, block anything else left over.
  if (out.includes("{{BOOKING_LINK}}") && bookingLink) {
    out = out.split("{{BOOKING_LINK}}").join(bookingLink);
    fixes.push("booking_link_placeholder");
  }
  const blocked = /\{\{[^}]*\}\}/.test(out);

  // Word ranges first (days, months, times, abbreviations), so the dash
  // rules below never turn "Mon - Fri" into "Mon, Fri".
  const wordRanged = normalizeWordRanges(out);
  if (wordRanged !== out) fixes.push("range");
  out = wordRanged;

  // Numeric ranges keep a plain hyphen: "3–4 weeks" → "3-4 weeks".
  const ranged = out.replace(/(\d)\s*[–—]\s*(\d)/g, "$1-$2");
  // A spaced hyphen used as a dash ("the link - it shows") is the same tell
  // as an em dash. Only a hyphen with spaces on both sides, on one line, and
  // not between two digit-ended/-started tokens ("9am - 6pm", "512 - 555"
  // stay). Hyphens inside words, URLs, phone numbers and "9-5" have no
  // spaces around them and are never touched.
  const hyphenDashed = ranged.replace(/(?<=[^\s\d])[ \t]+-[ \t]+(?=[^\s\d])/g, " — ");
  // Any other em/en dash becomes a comma break: "not exactly — I'm" →
  // "not exactly, I'm". A dash that ends a clause before punctuation is dropped.
  const dashed = hyphenDashed
    .replace(/\s*[—–]+\s*(?=[.!?,])/g, "")
    .replace(/\s*[—–]+\s*/g, ", ");
  if (dashed !== out) fixes.push("dash");
  out = dashed;

  if (out.includes("…")) {
    out = out.replace(/…/g, "...");
    fixes.push("ellipsis_char");
  }

  if (/;\s/.test(out)) {
    out = out.replace(/;\s+/g, ". ");
    fixes.push("semicolon");
  }

  const demarked = out
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "");
  if (demarked !== out) fixes.push("markdown");
  out = demarked;

  for (const re of FILLER_OPENERS) {
    const m = out.match(re);
    if (m && out.length > m[0].length) {
      out = capitalizeLike(out, out.slice(m[0].length));
      fixes.push("filler_opener");
      break;
    }
  }

  // Tidy what the rewrites can leave behind: ", ," / ",." / double spaces,
  // and a comma at the very start.
  out = out
    .replace(/,\s*,/g, ",")
    .replace(/,\s*([.!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^\s*,\s*/, "")
    .trim();

  const lower = out.toLowerCase();
  for (const phrase of AI_TELL_PHRASES) {
    if (lower.includes(phrase)) flags.push(phrase);
  }

  return { text: out, fixes, flags, blocked, handoff: null };
}
