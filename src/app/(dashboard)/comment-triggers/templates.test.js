import { describe, it, expect } from "vitest";
import { templatesByClassFrom } from "./templates";

describe("templatesByClassFrom", () => {
  it("a written template counts; blank or missing does not", () => {
    expect(
      templatesByClassFrom([
        { intent_class: "HIGH_INTENT", template: "hey {{COMMENTER_NAME}}" },
        { intent_class: "ENGAGED_NOT_BUYING", template: "   " },
        { intent_class: "UNCERTAIN", template: null },
        { template: "orphan" },
      ])
    ).toEqual({ HIGH_INTENT: true, ENGAGED_NOT_BUYING: false, UNCERTAIN: false });
  });
  it("the old body column is not read", () => {
    expect(templatesByClassFrom([{ intent_class: "HIGH_INTENT", body: "hi" }])).toEqual({ HIGH_INTENT: false });
  });
  it("handles no rows", () => {
    expect(templatesByClassFrom(null)).toEqual({});
  });
});
