import { describe, it, expect } from "vitest";
import { billingPageView, isManagedAccount, MANAGED_ACCESS_KINDS } from "./managed";

describe("billingPageView (/billing)", () => {
  it("comped: complimentary, no price, no portal, no plan buttons, even with a Stripe customer", () => {
    expect(billingPageView({ access: { kind: "comped", hasAccess: true }, hasStripeCustomer: true })).toEqual({
      managed: true,
      showPrice: false,
      showPortal: false,
      showPlanButtons: false,
    });
  });

  it("a Stripe subscriber keeps price, portal and plan buttons", () => {
    expect(billingPageView({ access: { kind: "stripe", hasAccess: true }, hasStripeCustomer: true })).toEqual({
      managed: false,
      showPrice: true,
      showPortal: true,
      showPlanButtons: true,
    });
  });

  it.each([
    ["no access yet", { kind: "none", hasAccess: false }],
    ["legacy trial", { kind: "legacy_trial", hasAccess: true }],
    ["access unknown (request failed)", null],
  ])("%s: can still subscribe", (_label, access) => {
    expect(billingPageView({ access, hasStripeCustomer: false })).toMatchObject({ managed: false, showPlanButtons: true, showPortal: false });
  });

  it("future managed kinds are one entry away", () => {
    expect(isManagedAccount({ kind: "managed" })).toBe(false);
    MANAGED_ACCESS_KINDS.add("managed");
    expect(isManagedAccount({ kind: "managed" })).toBe(true);
    MANAGED_ACCESS_KINDS.delete("managed");
  });
});
