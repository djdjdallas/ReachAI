// Intent signals in comments on clinic accounts. On a watched clinic post,
// a comment that names a treatment or says an interest phrase is a lead,
// even when the comment classifier is unsure: "I would love to check you
// guys out... Botox" on "Grand Opening.. Comment Botox for 10% off" came
// back UNCERTAIN 0.55. Complaints are checked before this (complaint.js).

import { matchTreatment, normalizeTreatmentCategories } from "@/lib/outbound-webhooks/lead-capture";
import { postTreatment } from "./treatment";

const INTEREST_PHRASES = [
  "interested", "want", "wanna", "need", "love to", "would love",
  "how much", "price", "prices", "pricing", "cost", "book", "booking",
  "appointment", "check you out", "check you guys out", "check y'all out",
  // Spanish
  "me interesa", "interesada", "interesado", "quiero", "necesito",
  "cuánto", "cuanto", "precio", "precios", "cita", "agendar",
];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Whole words, Unicode-aware, case-insensitive; spaces match any whitespace.
const INTEREST_RE = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${INTEREST_PHRASES.map((t) => escapeRe(t).replace(/ /g, "\\s+")).join("|")})(?![\\p{L}\\p{N}])`,
  "iu"
);

/** Whether the comment says an interest phrase. */
export function hasInterestPhrase(text) {
  return INTEREST_RE.test(String(text ?? "").replace(/[’‘]/g, "'"));
}

/**
 * Whether the comment names one of the account's treatments (its match
 * terms or label) or the post's tagged treatment, or says an interest
 * phrase.
 *
 * @param {{ownerUser: object|null, treatmentKey: string|null, commentText: string}} args
 * @returns {boolean}
 */
export function hasClinicIntentSignal({ ownerUser, treatmentKey, commentText }) {
  const text = String(commentText ?? "");
  if (!text.trim()) return false;
  if (hasInterestPhrase(text)) return true;
  const categories = normalizeTreatmentCategories(ownerUser?.treatment_categories).map((c) => ({
    key: c.key,
    match: c.label ? [...c.match, c.label.toLowerCase()] : c.match,
  }));
  if (matchTreatment(categories, text)) return true;
  // The tagged treatment's label, if its terms didn't already match.
  const tagged = postTreatment(ownerUser, treatmentKey);
  return Boolean(tagged && matchTreatment([{ key: tagged.key, match: [tagged.label.toLowerCase()] }], text));
}
