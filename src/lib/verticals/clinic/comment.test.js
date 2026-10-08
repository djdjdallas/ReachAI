import { describe, it, expect } from "vitest";
import { applyClinicCommentRules, prepareClinicComment } from "./comment";

const dm = { action: "dm", rendered: "Hi!", reason: "template_rendered:HIGH_INTENT" };
const queued = (cls, reason = `routed_by_class:${cls}`) => ({ action: "queue_review", rendered: null, reason });
const run = (cls, decision, text = "how much?") => applyClinicCommentRules({ classification: { class: cls }, commentText: text, decision });

describe("applyClinicCommentRules", () => {
  it("a confident inquiry DMs as decided", () => {
    expect(run("HIGH_INTENT", dm)).toEqual({ decision: dm, handoff: null });
  });

  it("complaints never DM and are handed off: classifier or keyword", () => {
    expect(run("CRITICAL_NEGATIVE", dm, "scam")).toEqual({
      decision: { action: "queue_review", rendered: null, reason: "clinic_complaint" },
      handoff: "complaint",
    });
    expect(run("HIGH_INTENT", dm, "my lips are still lumpy, how do I fix it?").handoff).toBe("complaint");
    expect(run("CRITICAL_NEGATIVE", { action: "ignore", rendered: null, reason: "x" }, "refund").decision.action).toBe("queue_review");
  });

  it("praise is ignored: no DM, no handoff, whatever the post says", () => {
    for (const d of [dm, queued("ENGAGED_NOT_BUYING")]) {
      expect(run("ENGAGED_NOT_BUYING", d, "so pretty 😍")).toEqual({
        decision: { action: "ignore", rendered: null, reason: "clinic_praise_ignored" },
        handoff: null,
      });
    }
  });

  it("queued comments that might be inquiries are handed off", () => {
    expect(run("HIGH_INTENT", queued("HIGH_INTENT", "low_confidence:HIGH_INTENT")).handoff).toBe("inquiry");
    expect(run("HIGH_INTENT", queued("HIGH_INTENT", "no_template_for_class")).handoff).toBe("inquiry");
    expect(run("UNCERTAIN", queued("UNCERTAIN")).handoff).toBe("inquiry");
  });

  it("other classes keep the shared decision and stay silent", () => {
    for (const cls of ["LOW_SIGNAL", "NOT_A_LEAD", "SPAM"]) {
      const ignore = { action: "ignore", rendered: null, reason: `routed_by_class:${cls}` };
      expect(run(cls, ignore, "ok")).toEqual({ decision: ignore, handoff: null });
      expect(run(cls, queued(cls), "ok")).toEqual({ decision: queued(cls), handoff: null });
    }
  });
});

describe("prepareClinicComment", () => {
  const ownerUser = { treatment_categories: [{ key: "botox", match: ["botox"], label: "Botox" }] };
  const templates = { HIGH_INTENT: "About {{TREATMENT|our menu}}: {{BOOKING_LINK}}" };

  it("a tagged post: the key, and {{TREATMENT}} rendered in every template", () => {
    expect(prepareClinicComment({ ownerUser, monitoringRow: { treatment_key: "botox" }, templates })).toEqual({
      treatmentKey: "botox",
      templates: { HIGH_INTENT: "About Botox: {{BOOKING_LINK}}" },
    });
  });
  it("untagged, or a tag no longer in the list: the fallback, no key", () => {
    for (const monitoringRow of [{}, { treatment_key: "laser" }]) {
      expect(prepareClinicComment({ ownerUser, monitoringRow, templates })).toEqual({
        treatmentKey: null,
        templates: { HIGH_INTENT: "About our menu: {{BOOKING_LINK}}" },
      });
    }
  });
});

describe("applyClinicCommentRules: intent signal", () => {
  const ownerUser = { treatment_categories: [{ key: "botox", match: ["botox"] }] };
  const high = { action: "dm", rendered: "Hey!", reason: "template_rendered:HIGH_INTENT" };
  const decideHighIntent = () => high;
  const runSig = (cls, text, decision = queued(cls)) =>
    applyClinicCommentRules({ classification: { class: cls }, commentText: text, decision, ownerUser, decideHighIntent });

  it("UNCERTAIN, LOW_SIGNAL, low-confidence HIGH_INTENT and praise with a signal take the HIGH_INTENT decision", () => {
    for (const cls of ["UNCERTAIN", "LOW_SIGNAL", "HIGH_INTENT", "ENGAGED_NOT_BUYING"]) {
      expect(runSig(cls, "love my botox, how much for more?")).toEqual({
        decision: { ...high, reason: "clinic_intent_signal:template_rendered:HIGH_INTENT" },
        handoff: null,
      });
    }
  });
  it("spam and personal messages are never upgraded", () => {
    for (const cls of ["SPAM", "NOT_A_LEAD"]) {
      const ignore = { action: "ignore", rendered: null, reason: `routed_by_class:${cls}` };
      expect(runSig(cls, "botox how much", ignore).decision).toBe(ignore);
    }
  });
  it("a complaint wins over a signal", () => {
    expect(runSig("UNCERTAIN", "I want a refund for my botox").handoff).toBe("complaint");
  });
  it("the HIGH_INTENT decision queues (no template): handed off as an inquiry", () => {
    const r = applyClinicCommentRules({
      classification: { class: "UNCERTAIN" },
      commentText: "how much",
      decision: queued("UNCERTAIN"),
      ownerUser,
      decideHighIntent: () => ({ action: "queue_review", rendered: null, reason: "no_template_for_class" }),
    });
    expect(r).toEqual({ decision: { action: "queue_review", rendered: null, reason: "clinic_intent_signal:no_template_for_class" }, handoff: "inquiry" });
  });
  it("an existing DM decision is left alone", () => {
    expect(runSig("HIGH_INTENT", "how much", dm).decision).toBe(dm);
  });
});
