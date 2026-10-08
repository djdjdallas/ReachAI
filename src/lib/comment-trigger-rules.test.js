import { describe, it, expect } from "vitest";
import { decideAction, renderTemplate, DM_MIN_CONFIDENCE } from "./comment-trigger-rules";

const templates = { HIGH_INTENT: "hey {{COMMENTER_NAME}}, here's the link: {{BOOKING_LINK}}" };
const ctx = { commenterName: "sam", bookingLink: "https://cal.com/x" };
const cls = (c, confidence) => ({ class: c, confidence });

describe("decideAction", () => {
  it("DMs a confident HIGH_INTENT with a template", () => {
    expect(decideAction(cls("HIGH_INTENT", 0.94), null, templates, ctx)).toEqual({
      action: "dm",
      rendered: "hey sam, here's the link: https://cal.com/x",
      reason: "template_rendered:HIGH_INTENT",
    });
  });

  it("queues a low-confidence HIGH_INTENT for review instead of DMing", () => {
    expect(decideAction(cls("HIGH_INTENT", DM_MIN_CONFIDENCE - 0.01), null, templates, ctx)).toEqual({
      action: "queue_review",
      rendered: null,
      reason: "low_confidence:HIGH_INTENT",
    });
  });

  it("treats a missing confidence as low", () => {
    expect(decideAction({ class: "HIGH_INTENT" }, null, templates, ctx).action).toBe("queue_review");
  });

  it("applies the floor to any class a coach routes to DM", () => {
    const monitoring = { actions_per_class: { ENGAGED_NOT_BUYING: "dm" } };
    const t = { ENGAGED_NOT_BUYING: "thanks {{COMMENTER_NAME}}!" };
    expect(decideAction(cls("ENGAGED_NOT_BUYING", 0.6), monitoring, t, ctx).action).toBe("queue_review");
    expect(decideAction(cls("ENGAGED_NOT_BUYING", 0.9), monitoring, t, ctx).action).toBe("dm");
  });

  it("downgrades to review with no template", () => {
    expect(decideAction(cls("HIGH_INTENT", 0.95), null, {}, ctx).reason).toBe("no_template_for_class");
  });

  it.each([
    ["CRITICAL_NEGATIVE", "ignore"],
    ["LOW_SIGNAL", "ignore"],
    ["NOT_A_LEAD", "ignore"],
    ["SPAM", "ignore"],
    ["ENGAGED_NOT_BUYING", "queue_review"],
    ["UNCERTAIN", "queue_review"],
  ])("routes %s to %s by default", (c, action) => {
    expect(decideAction(cls(c, 0.99), null, templates, ctx).action).toBe(action);
  });

  it("ignores everything on a post with monitoring disabled", () => {
    expect(decideAction(cls("HIGH_INTENT", 0.99), { enabled: false }, templates, ctx).action).toBe("ignore");
  });
});

describe("renderTemplate", () => {
  it("falls back when context is missing", () => {
    expect(renderTemplate("hey {{COMMENTER_NAME}}, about {{OFFER_NAME}}")).toBe("hey there, about our offer");
  });
});

describe("renderTemplate {{TREATMENT}}", () => {
  it("renders the post's treatment label", () => {
    expect(renderTemplate("Curious about {{TREATMENT}}?", { treatment: "lip filler" })).toBe("Curious about lip filler?");
  });
  it("an untagged post gets the default fallback", () => {
    expect(renderTemplate("Curious about {{TREATMENT}}?", {})).toBe("Curious about our treatments?");
  });
  it("an untagged post gets the template's own fallback", () => {
    expect(renderTemplate("First time trying {{TREATMENT|this treatment}}?", {})).toBe("First time trying this treatment?");
  });
  it("a tagged post ignores the template's fallback", () => {
    expect(renderTemplate("First time trying {{TREATMENT|this treatment}}?", { treatment: "Botox" })).toBe("First time trying Botox?");
  });
  it("renders every occurrence alongside the other tokens", () => {
    expect(
      renderTemplate("{{TREATMENT}} with {{COMMENTER_NAME}}: {{TREATMENT|x}} {{BOOKING_LINK}}", {
        treatment: "Botox",
        commenterName: "jane",
        bookingLink: "https://book.example/now",
      })
    ).toBe("Botox with jane: Botox https://book.example/now");
  });
});
