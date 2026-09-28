// Decides what the webhook does with a DM intent classification BEFORE any
// reply is generated. Pure — the route performs the side effects. Split out
// so the reply/hold/pause rules are unit-testable without the webhook.
//
// Decided 2026-09-28 (audits/dm-classifier-prompt-audit-2026-09-28.md §8):
//   - do_not_send at ANY confidence suppresses this turn's reply. Only a
//     confident one (>= DO_NOT_SEND_PAUSE_THRESHOLD) pauses the thread; a
//     low-confidence one holds the turn and leaves the thread live.
//   - not_a_lead (owner's personal contacts, off-topic chat, people pitching
//     the owner) gets no reply and no pause, so a real question next turn is
//     still answered.
//   - The owner is emailed only for pauses a human must act on (hostility,
//     refund/legal, crisis). Injection and spam pauses stay silent.
//   - A missing classification (timeout/error) still replies: fail-open is
//     deliberate.
//
// Precedence (PR C): do_not_send → not_a_lead → human-in-loop escalation →
// reply. The escalation check runs in parallel with the intent classifier
// and only decides when neither intent rule applies, so a hostile message
// is always handled as do_not_send, whatever the coach's HIL setting.

import { DO_NOT_SEND_PAUSE_THRESHOLD } from "./dm-intent";
import { pauseReasonForDoNotSend } from "./dm-pause-reason";

/**
 * Confidence required for not_a_lead to suppress the reply. Below this the
 * message is answered normally — a misread lead costs more than one AI reply
 * to a friend.
 */
export const NOT_A_LEAD_SKIP_THRESHOLD = 0.7;

/** Pause reasons that email the account owner. */
export const OWNER_ALERT_PAUSE_REASONS = ["hostile_or_refund", "crisis_signal"];

/**
 * @param {{class: string, confidence: number, signals?: string[]}|null} dmIntent
 * @param {{needs_human?: boolean}|null} [escalation] - human-in-loop outcome;
 *   null when HIL is off or the check failed
 * @returns {{action: "reply"}
 *   | {action: "skip_not_a_lead"}
 *   | {action: "hold"}
 *   | {action: "pause", pauseReason: string, emailOwner: boolean}}
 */
export function decideIntentGate(dmIntent, escalation = null) {
  const escalate = escalation?.needs_human === true;
  if (!dmIntent) {
    return escalate
      ? { action: "pause", pauseReason: "complex_objection", emailOwner: true }
      : { action: "reply" };
  }
  const conf = typeof dmIntent.confidence === "number" ? dmIntent.confidence : 0;

  if (dmIntent.class === "do_not_send") {
    if (conf < DO_NOT_SEND_PAUSE_THRESHOLD) return { action: "hold" };
    const pauseReason = pauseReasonForDoNotSend(dmIntent.signals);
    return {
      action: "pause",
      pauseReason,
      emailOwner: OWNER_ALERT_PAUSE_REASONS.includes(pauseReason),
    };
  }

  if (dmIntent.class === "not_a_lead" && conf >= NOT_A_LEAD_SKIP_THRESHOLD) {
    return { action: "skip_not_a_lead" };
  }

  if (escalate) {
    return { action: "pause", pauseReason: "complex_objection", emailOwner: true };
  }

  return { action: "reply" };
}
