// Leaf module — no imports. Maps a do_not_send classification's signals to a
// specific, debuggable conversations.ai_pause_reason. Extracted verbatim from
// src/app/api/webhooks/instagram/route.js so it can be unit-tested without
// loading the webhook route.
//
// Previously every do_not_send pause flattened to 'hostile_or_refund', which
// mislabeled benign-but-suspicious flags. Concretely: the อัศวิน thread was a
// coach who DM'd Dom and whose message echoed coach-outreach-script language;
// the classifier correctly flagged it do_not_send with signals
// ['echoes_coach_script', ...], but the DB recorded ai_pause_reason=
// 'hostile_or_refund', implying hostility that wasn't there. We now preserve
// the most specific signal so the dashboard reason chip is accurate. This is a
// debuggability change only — it does NOT alter whether the AI pauses, and it
// does NOT touch the classifier's signal definitions (see src/lib/dm-intent.js).
//
// Priority order matters: a message that is BOTH hostile and script-echoing is
// hostility first. Prompt injection is the most severe and wins outright.
// Crisis is split out from hostility so the owner alert and the dashboard say
// "check on this person", not "this person is hostile".
//
// The classifier prompt (src/lib/dm-intent.js) tells the model to tag
// do_not_send with exactly these signal names — keep the two in sync.
export const DO_NOT_SEND_REASON_RULES = [
  { reason: "prompt_injection", signals: ["prompt_injection_attempt"] },
  { reason: "crisis_signal", signals: ["crisis_signal", "self_harm", "suicide"] },
  {
    reason: "hostile_or_refund",
    signals: [
      "refund_demand", "chargeback_threat", "scam_accusation", "legal_threat",
      "hate_speech", "hostile", "abuse", "abusive", "threat",
    ],
  },
  {
    reason: "flagged_coach_script",
    signals: ["echoes_coach_script", "suspicious_pattern", "likely_test_or_probe"],
  },
];

export function pauseReasonForDoNotSend(signals) {
  const sigs = Array.isArray(signals)
    ? signals.map((s) => String(s).toLowerCase())
    : [];
  for (const rule of DO_NOT_SEND_REASON_RULES) {
    if (rule.signals.some((s) => sigs.includes(s))) return rule.reason;
  }
  // No recognized signal — keep a generic do_not_send marker rather than
  // overstating it as hostility. 'hostile_or_refund' is reserved for the
  // hostility/refund signal set above.
  return "flagged_do_not_send";
}
