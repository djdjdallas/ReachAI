// Complaint check for comments on persona (clinic) accounts. Leaf module,
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

const TERMS = [
  // Money and legal
  "refund", "refunds", "refunded", "money back", "chargeback", "charge back",
  "dispute", "disputed", "lawsuit", "suing", "lawyer", "attorney",
  // Outcome. Words that also describe what a lead wants fixed ("uneven skin
  // tone", "acne scarred", "dissolve my old filler") are left out: those
  // are leads.
  "botched", "ruined", "messed up", "went wrong", "gone wrong",
  "worst experience", "never again", "never coming back",
  "made it worse", "look worse", "looks worse", "asymmetrical", "lopsided",
  "lumpy", "lumps", "migrated", "droopy", "drooping", "eyelid droop",
  "ptosis", "overfilled",
  // Side effects and complications
  "side effect", "side effects", "allergic reaction", "bad reaction",
  "infection", "infected", "complication", "complications", "necrosis",
  "occlusion", "blister", "blisters", "blistering", "burned me", "burnt",
  "still swollen", "still bruised", "won't go away", "wont go away",
  "hospital", "emergency room", "urgent care",
  // Spanish
  "reembolso", "devolución", "devolucion", "estafa", "demanda", "abogado",
  "arruinado", "arruinada", "arruinaron", "efecto secundario",
  "efectos secundarios", "infección", "infeccion", "reacción alérgica",
  "reaccion alergica", "complicación", "complicacion",
];

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Whole words, Unicode-aware, case-insensitive. Spaces in a term match any
// run of whitespace.
const COMPLAINT_RE = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${TERMS.map((t) => escapeRe(t).replace(/ /g, "\\s+")).join("|")})(?![\\p{L}\\p{N}])`,
  "iu"
);

/**
 * @param {string} text - the comment
 * @returns {boolean} true when the comment reads as a complaint, a bad
 *   outcome, a side effect or a refund
 */
export function looksLikeComplaint(text) {
  return COMPLAINT_RE.test(String(text ?? "").replace(/[’‘]/g, "'"));
}
