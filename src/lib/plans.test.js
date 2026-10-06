import { describe, it, expect } from "vitest";
import { planButtonLabel } from "./plans";

describe("planButtonLabel (/billing)", () => {
  it("never calls a cheaper plan an upgrade", () => {
    expect(planButtonLabel({ currentPlanId: "unlimited", hasLivePlan: true, targetPlanId: "base" })).toBe("Switch to Base");
  });

  it("a pricier plan is an upgrade", () => {
    expect(planButtonLabel({ currentPlanId: "base", hasLivePlan: true, targetPlanId: "unlimited" })).toBe("Upgrade");
  });

  it("without a live plan every plan is Subscribe, whatever users.plan defaults to", () => {
    for (const target of ["base", "unlimited"]) {
      expect(planButtonLabel({ currentPlanId: "base", hasLivePlan: false, targetPlanId: target })).toBe("Subscribe");
      expect(planButtonLabel({ currentPlanId: "unlimited", hasLivePlan: false, targetPlanId: target })).toBe("Subscribe");
    }
  });

  it("an unknown plan id gets a neutral label", () => {
    expect(planButtonLabel({ currentPlanId: "legacy_pro", hasLivePlan: true, targetPlanId: "base" })).toBe("Switch plan");
  });
});
