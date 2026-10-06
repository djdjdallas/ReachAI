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
// Precedence (PR C, + knowledge base PR A): do_not_send → not_a_lead →
// medical_question signal → human-in-loop escalation → reply.
//
// medical_question (any class, any confidence; including a do_not_send whose
// only reason is the medical signal) hands off BEFORE the voice
// step and before generation: the lead gets the fixed holding text and the
// thread pauses for the owner. A not_a_lead skip wins over it (no reply at
// all is just as safe, and a friend's "my knee hurts lol" shouldn't get a
// holding reply). The escalation check runs in parallel with the intent classifier
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

/** Classifier signal that routes a message to the medical handoff. */
export const MEDICAL_SIGNAL = "medical_question";

export function hasMedicalSignal(dmIntent) {
  return (
    Array.isArray(dmIntent?.signals) &&
    dmIntent.signals.some((s) => String(s).toLowerCase() === MEDICAL_SIGNAL)
  );
}

/**
 * @param {{class: string, confidence: number, signals?: string[]}|null} dmIntent
 * @param {{needs_human?: boolean}|null} [escalation] - human-in-loop outcome;
 *   null when HIL is off or the check failed
 * @returns {{action: "reply"}
 *   | {action: "skip_not_a_lead"}
 *   | {action: "hold"}
 *   | {action: "pause", pauseReason: string, emailOwner: boolean}
 *   | {action: "handoff", category: "medical_question"}}
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
    const pauseReason = pauseReasonForDoNotSend(dmIntent.signals);
    // A health question the classifier filed as do_not_send with no
    // crisis, hostility, injection, or script signal is a medical handoff:
    // a silent pause or hold would leave the lead with no reply and the
    // owner with no email. Live eval 2026-10-05: "can i get botox while
    // breastfeeding" to a strength coach came back do_not_send 0.92,
    // signals [medical_question, off_topic].
    if (pauseReason === "flagged_do_not_send" && hasMedicalSignal(dmIntent)) {
      return { action: "handoff", category: MEDICAL_SIGNAL };
    }
    if (conf < DO_NOT_SEND_PAUSE_THRESHOLD) return { action: "hold" };
    return {
      action: "pause",
      pauseReason,
      emailOwner: OWNER_ALERT_PAUSE_REASONS.includes(pauseReason),
    };
  }

  if (dmIntent.class === "not_a_lead" && conf >= NOT_A_LEAD_SKIP_THRESHOLD) {
    return { action: "skip_not_a_lead" };
  }

  if (hasMedicalSignal(dmIntent)) {
    return { action: "handoff", category: MEDICAL_SIGNAL };
  }

  if (escalate) {
    return { action: "pause", pauseReason: "complex_objection", emailOwner: true };
  }

  return { action: "reply" };
}
