import { describe, it, expect } from "vitest";
import { pauseReasonForDoNotSend } from "./dm-pause-reason";

describe("pauseReasonForDoNotSend", () => {
  const cases = [
    [["prompt_injection_attempt"], "prompt_injection", "injection"],
    [["prompt_injection_attempt", "refund_demand"], "prompt_injection", "injection outranks hostility"],
    [["refund_demand", "chargeback_threat"], "hostile_or_refund", "refund + chargeback"],
    [["crisis_signal"], "hostile_or_refund", "crisis signal"],
    [["legal_threat"], "hostile_or_refund", "legal threat"],
    [["echoes_coach_script", "hostile"], "hostile_or_refund", "hostility outranks script echo"],
    [["echoes_coach_script"], "flagged_coach_script", "script echo (the อัศวิน thread)"],
    [["REFUND_DEMAND"], "hostile_or_refund", "case-insensitive"],
    [[], "flagged_do_not_send", "no signals"],
    [undefined, "flagged_do_not_send", "missing signals"],
  ];
  it.each(cases)("%j → %s (%s)", (signals, expected) => {
    expect(pauseReasonForDoNotSend(signals)).toBe(expected);
  });

  // Signals the model actually emitted on the 5 prod do_not_send rows
  // (audits/dm-classifier-prompt-audit-2026-09-28.md P0-1/P2-5). None map to
  // a rule, so every one of those pauses was recorded as the generic reason.
  it.each([
    [["not_target_customer", "wrong_fit", "cannabis_retail"]],
    [["off_topic_personal_chatter", "no_sales_intent", "casual_banter"]],
    [["off_topic_rant", "inflammatory_political_content", "hostile_tone"]],
    [["looped_ai_message", "potential_system_error", "suspicious_echo"]],
    [["incoherent_message", "likely_spam_or_misdirected", "off_topic"]],
  ])("observed prod signals %j fall through to flagged_do_not_send", (signals) => {
    expect(pauseReasonForDoNotSend(signals)).toBe("flagged_do_not_send");
  });
});
