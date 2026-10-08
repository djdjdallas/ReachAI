// Complaint check for comments on clinic (persona) accounts. Leaf module,
// no imports.
//
// A comment about a bad outcome, a side effect or a refund must never get a
// sales DM. The classifier's CRITICAL_NEGATIVE covers hostility and refund
// demands, but a calm report ("my lips are still lumpy 3 weeks later, is
// that normal?") reads as a question and can come back HIGH_INTENT. This
// catches those before the template goes out.
//
// Deliberately broad: a false positive hands one comment to a person (the
// clinic sees it in Needs attention); a miss sends a sales DM to someone
// reporting a complication.

// A complaint on its own.
const TERMS = [
  // Money and legal. "demanda" alone is left out ("hay mucha demanda"); the
  // verb forms are a threat.
  "refund", "refunds", "refunded", "money back", "chargeback", "charge back",
  "dispute", "disputed", "lawsuit", "suing", "lawyer", "attorney",
  // Outcome. Words that also describe what a lead wants fixed ("uneven skin
  // tone", "acne scarred", "dissolve my old filler") are left out: those
  // are leads.
  "botched", "ruined", "messed up", "went wrong", "gone wrong",
  "worst experience", "never again", "never coming back",
  "made it worse", "look worse", "looks worse",
  "lumpy", "lumps", "migrated", "overfilled",
  // Complications. "burnt" alone is left out ("burnt out, need a facial").
  "allergic reaction", "bad reaction",
  "infection", "infected", "complication", "complications", "necrosis",
  "occlusion", "blister", "blisters", "blistering", "burned me",
  "still swollen", "still bruised", "won't go away", "wont go away",
  "hospital", "emergency room", "urgent care",
  // Spanish
  "reembolso", "devolución", "devolucion", "estafa", "demandar",
  "los demandaré", "los demandare", "abogado",
  "arruinado", "arruinada", "arruinaron", "infección", "infeccion",
  "reacción alérgica", "reaccion alergica", "complicación", "complicacion",
];

// A complaint only next to complaint context: on their own these are what
// a lead asks about or wants fixed ("what are the side effects?", "can
// botox help my droopy brows?", "lopsided lips, can filler fix that?").
const CONTEXT_TERMS = [
  "side effect", "side effects", "droopy", "drooping", "eyelid droop",
  "ptosis", "asymmetrical", "lopsided",
  "efecto secundario", "efectos secundarios",
];
// The context: it happened after, since or because of a treatment here.
const CONTEXT = [
  "after", "since", "you did", "you guys did", "from my appointment",
  "después", "despues", "desde", "me hicieron", "de mi cita",
];

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Whole words, Unicode-aware, case-insensitive. Spaces in a term match any
// run of whitespace.
const wordsRe = (terms) =>
  new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${terms.map((t) => escapeRe(t).replace(/ /g, "\\s+")).join("|")})(?![\\p{L}\\p{N}])`,
    "iu"
  );
const COMPLAINT_RE = wordsRe(TERMS);
const CONTEXT_TERM_RE = wordsRe(CONTEXT_TERMS);
const CONTEXT_RE = wordsRe(CONTEXT);

/**
 * @param {string} text - the comment
 * @returns {boolean} true when the comment reads as a complaint, a bad
 *   outcome, a side effect or a refund
 */
export function looksLikeComplaint(text) {
  const t = String(text ?? "").replace(/[’‘]/g, "'");
  return COMPLAINT_RE.test(t) || (CONTEXT_TERM_RE.test(t) && CONTEXT_RE.test(t));
}
