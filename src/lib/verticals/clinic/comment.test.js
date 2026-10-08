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
