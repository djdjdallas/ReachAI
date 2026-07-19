// Leaf module — no imports, safe for client and server. Maps the DM intent
// classifier's first-message class to a conversations.status value so the
// triage badge reflects what the classifier already knows, instead of every
// thread being born WARM LEAD.
//
// Why this file exists: src/lib/dm-intent.js pulls in the Anthropic SDK,
// which is Node-only. Importing from there into a 'use client' component
// drags Node deps into the browser bundle (see src/lib/voice/intent-classes.js
// for the same pattern).
//
// INVARIANT: this mapping never demotes an engaged prospect. The worst case
// for a real lead is 'new' (untriaged) until their next message — never a
// wrongly-cold label. Only a high-confidence do_not_send can produce
// 'not_a_fit', and that same confidence bar already pauses the AI.

/**
 * Minimum classifier confidence required to promote a brand-new
 * conversation out of 'new'. Below this, the thread stays 'new' —
 * including the classifier's own error fallback (class 'follow_up',
 * confidence 0), so parse-misses stay honest. Deliberately a separate
 * constant from VOICE_ROUTING_THRESHOLD (src/lib/dm-intent.js), which
 * tunes independently.
 */
export const STATUS_PROMOTION_THRESHOLD = 0.5;

/**
 * Confidence required for a do_not_send classification to mark the thread
 * 'not_a_fit'. Keep in sync with DO_NOT_SEND_PAUSE_THRESHOLD in
 * src/lib/dm-intent.js (kept as a literal here so this module stays
 * SDK-free) — the cold label and the AI pause fire on the same evidence.
 */
export const DO_NOT_SEND_COLD_THRESHOLD = 0.7;

/**
 * First-message intent class → conversations.status. 'follow_up' is the
 * classifier's catch-all for noise ("hey random msg lol", off-topic chat)
 * and its error fallback, so it never promotes. 'do_not_send' is only
 * applied at >= DO_NOT_SEND_COLD_THRESHOLD via statusForIntent().
 */
export const INTENT_TO_STATUS = {
  warm_intent: "qualifying",
  booking_cta: "interested",
  // An objection on message one means the lead is engaging with the offer.
  objection_price: "qualifying",
  objection_time: "qualifying",
  objection_trust: "qualifying",
  follow_up: "new",
  do_not_send: "not_a_fit",
};

/**
 * Resolve the status a brand-new conversation should hold after its first
 * inbound message is classified. Returns 'new' whenever the evidence is
 * too weak to promote.
 *
 * @param {string} intentClass - one of DM_INTENT_CLASSES
 * @param {number} confidence  - classifier confidence, 0..1
 * @returns {string} a conversations.status value
 */
export function statusForIntent(intentClass, confidence) {
  const conf = typeof confidence === "number" ? confidence : 0;
  if (conf < STATUS_PROMOTION_THRESHOLD) return "new";
  if (intentClass === "do_not_send") {
    return conf >= DO_NOT_SEND_COLD_THRESHOLD ? "not_a_fit" : "new";
  }
  return INTENT_TO_STATUS[intentClass] || "new";
}
