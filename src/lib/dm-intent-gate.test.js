import { describe, it, expect } from "vitest";
import { decideIntentGate, NOT_A_LEAD_SKIP_THRESHOLD } from "./dm-intent-gate";
import { DO_NOT_SEND_PAUSE_THRESHOLD } from "./dm-intent";

const intent = (cls, confidence, signals = []) => ({ class: cls, confidence, signals });

describe("decideIntentGate", () => {
  it("replies when classification is missing (fail-open)", () => {
    expect(decideIntentGate(null)).toEqual({ action: "reply" });
  });

  it.each(["warm_intent", "objection_price", "objection_time", "objection_trust", "booking_cta", "follow_up"])(
    "replies to lead class %s",
    (cls) => {
      expect(decideIntentGate(intent(cls, 0.95))).toEqual({ action: "reply" });
    }
  );

  it("holds a low-confidence do_not_send without pausing", () => {
    expect(decideIntentGate(intent("do_not_send", DO_NOT_SEND_PAUSE_THRESHOLD - 0.01, ["refund_demand"]))).toEqual({
      action: "hold",
    });
  });

  it("holds a do_not_send with no confidence at all", () => {
    expect(decideIntentGate(intent("do_not_send", undefined))).toEqual({ action: "hold" });
  });

  it.each([
    [["refund_demand"], "hostile_or_refund", true],
    [["legal_threat"], "hostile_or_refund", true],
    [["crisis_signal"], "crisis_signal", true],
    [["self_harm", "refund_demand"], "crisis_signal", true],
    [["prompt_injection_attempt"], "prompt_injection", false],
    [["off_topic"], "flagged_do_not_send", false],
  ])("pauses a confident do_not_send %j as %s (email owner: %s)", (signals, pauseReason, emailOwner) => {
    expect(decideIntentGate(intent("do_not_send", DO_NOT_SEND_PAUSE_THRESHOLD, signals))).toEqual({
      action: "pause",
      pauseReason,
      emailOwner,
    });
  });

  it("skips a confident not_a_lead without pausing", () => {
    expect(decideIntentGate(intent("not_a_lead", NOT_A_LEAD_SKIP_THRESHOLD))).toEqual({
      action: "skip_not_a_lead",
    });
  });

  it("replies to a low-confidence not_a_lead (a misread lead costs more)", () => {
    expect(decideIntentGate(intent("not_a_lead", NOT_A_LEAD_SKIP_THRESHOLD - 0.01))).toEqual({
      action: "reply",
    });
  });

  describe("with a human-in-loop escalation", () => {
    const esc = { needs_human: true };
    const escPause = { action: "pause", pauseReason: "complex_objection", emailOwner: true };

    it("escalates a lead message", () => {
      expect(decideIntentGate(intent("objection_price", 0.9), esc)).toEqual(escPause);
    });

    it("escalates when the intent classifier failed", () => {
      expect(decideIntentGate(null, esc)).toEqual(escPause);
    });

    it("lets a confident do_not_send win (hostility is never 'complex_objection')", () => {
      expect(decideIntentGate(intent("do_not_send", 0.95, ["refund_demand"]), esc)).toEqual({
        action: "pause",
        pauseReason: "hostile_or_refund",
        emailOwner: true,
      });
    });

    it("lets a low-confidence do_not_send hold rather than escalate", () => {
      expect(decideIntentGate(intent("do_not_send", 0.5), esc)).toEqual({ action: "hold" });
    });

    it("lets not_a_lead skip rather than escalate", () => {
      expect(decideIntentGate(intent("not_a_lead", 0.9), esc)).toEqual({ action: "skip_not_a_lead" });
    });

    it("replies when escalation says no", () => {
      expect(decideIntentGate(intent("follow_up", 0.9), { needs_human: false })).toEqual({ action: "reply" });
    });
  });
});
