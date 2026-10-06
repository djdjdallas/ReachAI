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

describe("decideIntentGate: medical handoff (knowledge base PR A)", () => {
  it.each(["warm_intent", "objection_trust", "follow_up", "booking_cta"])(
    "hands off a %s message tagged medical_question",
    (cls) => {
      expect(decideIntentGate(intent(cls, 0.9, ["asks_for_info", "medical_question"]))).toEqual({
        action: "handoff",
        category: "medical_question",
      });
    }
  );

  it("hands off at any confidence (the signal, not the class, decides)", () => {
    expect(decideIntentGate(intent("follow_up", 0.3, ["MEDICAL_QUESTION"])).action).toBe("handoff");
  });

  it("do_not_send still wins over the medical signal", () => {
    expect(decideIntentGate(intent("do_not_send", 0.95, ["crisis_signal", "medical_question"]))).toMatchObject({
      action: "pause",
      pauseReason: "crisis_signal",
    });
  });

  it.each([0.95, 0.4])(
    "a do_not_send (conf %s) whose only reason is the medical signal hands off, not a silent pause/hold",
    (conf) => {
      expect(decideIntentGate(intent("do_not_send", conf, ["medical_question", "off_topic"]))).toEqual({
        action: "handoff",
        category: "medical_question",
      });
    }
  );

  it.each([["prompt_injection_attempt", "prompt_injection"], ["refund_demand", "hostile_or_refund"]])(
    "a do_not_send with a real reason (%s) still pauses even with the medical signal",
    (signal, reason) => {
      expect(decideIntentGate(intent("do_not_send", 0.95, [signal, "medical_question"]))).toMatchObject({
        action: "pause",
        pauseReason: reason,
      });
    }
  );

  it("a confident not_a_lead stays silent rather than handing off", () => {
    expect(decideIntentGate(intent("not_a_lead", 0.9, ["personal_chat", "medical_question"]))).toEqual({
      action: "skip_not_a_lead",
    });
  });

  it("the medical handoff wins over a human-in-loop escalation", () => {
    expect(
      decideIntentGate(intent("follow_up", 0.9, ["medical_question"]), { needs_human: true })
    ).toEqual({ action: "handoff", category: "medical_question" });
  });

  it("no signal, no handoff", () => {
    expect(decideIntentGate(intent("follow_up", 0.9, ["asks_price"]))).toEqual({ action: "reply" });
  });
});
