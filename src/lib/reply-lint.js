// Pre-send filter for AI-written DMs. Every reply path runs the model's text
// through lintReply() before it is saved or sent. Leaf module, no imports.
//
// Why: prompt rules alone did not hold. 28 of 30 prod replies in the 60 days
// before 2026-09-28 contained em dashes despite a "NO em dashes" rule
// (audits/dm-classifier-prompt-audit-2026-09-28.md P1-10). The rule from Dom:
// replies must never carry em dashes or other tells that a machine wrote them.
//
// Three tiers:
//   fixes   — mechanical tells rewritten deterministically (dashes,
//             semicolons, ellipsis character, markdown, filler openers)
//   flags   — stock AI phrasing we can't safely rewrite; logged for
//             measurement, text left as-is
//   blocked — a leftover {{placeholder}}; sending it would be broken, so the
//             caller must not send

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

function capitalizeLike(original, text) {
  if (!text) return text;
  const wasUpper = /^[A-Z]/.test(original);
  return wasUpper ? text[0].toUpperCase() + text.slice(1) : text;
}

/**
 * @param {string} text - raw model output
 * @param {{bookingLink?: string}} [options]
 * @returns {{text: string, fixes: string[], flags: string[], blocked: boolean}}
 */
export function lintReply(text, { bookingLink = "" } = {}) {
  const fixes = [];
  const flags = [];
  let out = String(text ?? "").trim();

  // Placeholders: fill the booking link, block anything else left over.
  if (out.includes("{{BOOKING_LINK}}") && bookingLink) {
    out = out.split("{{BOOKING_LINK}}").join(bookingLink);
    fixes.push("booking_link_placeholder");
  }
  const blocked = /\{\{[^}]*\}\}/.test(out);

  // Numeric ranges keep a plain hyphen: "3–4 weeks" → "3-4 weeks".
  const ranged = out.replace(/(\d)\s*[–—]\s*(\d)/g, "$1-$2");
  // Any other em/en dash becomes a comma break: "not exactly — I'm" →
  // "not exactly, I'm". A dash that ends a clause before punctuation is dropped.
  const dashed = ranged
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

  return { text: out, fixes, flags, blocked };
}
