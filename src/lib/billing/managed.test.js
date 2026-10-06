import { describe, it, expect } from "vitest";
import { billingPageView, isManagedAccount, MANAGED_ACCESS_KINDS } from "./managed";

describe("billingPageView (/billing)", () => {
  it("comped: complimentary, no price, no portal, no plan buttons, even with a Stripe customer", () => {
    expect(billingPageView({ access: { kind: "comped", hasAccess: true }, hasStripeCustomer: true })).toEqual({
      managed: true,
      showPrice: false,
      showPortal: false,
      showPlanButtons: false,
      accessUnavailable: false,
    });
  });

  it("a Stripe subscriber keeps price, portal and plan buttons", () => {
    expect(billingPageView({ access: { kind: "stripe", hasAccess: true }, hasStripeCustomer: true })).toEqual({
      managed: false,
      showPrice: true,
      showPortal: true,
      showPlanButtons: true,
      accessUnavailable: false,
    });
  });

  it.each([
    ["no access yet", { kind: "none", hasAccess: false }],
    ["legacy trial", { kind: "legacy_trial", hasAccess: true }],
  ])("%s: can still subscribe", (_label, access) => {
    expect(billingPageView({ access, hasStripeCustomer: false })).toMatchObject({
      managed: false,
      showPlanButtons: true,
      showPortal: false,
      accessUnavailable: false,
    });
  });

  it("access still loading or failed (null): no plan buttons, so a comped account never sees Subscribe", () => {
    expect(billingPageView({ access: null, hasStripeCustomer: true })).toMatchObject({
      showPlanButtons: false,
      accessUnavailable: true,
    });
  });

  it("an ended comp is not managed: it sees plans and can subscribe", () => {
    const ended = { kind: "comped", hasAccess: false, reason: "comp_ended" };
    expect(isManagedAccount(ended)).toBe(false);
    expect(billingPageView({ access: ended, hasStripeCustomer: false })).toMatchObject({ managed: false, showPlanButtons: true });
  });

  it("future managed kinds are one entry away", () => {
    expect(isManagedAccount({ kind: "managed", hasAccess: true })).toBe(false);
    MANAGED_ACCESS_KINDS.add("managed");
    expect(isManagedAccount({ kind: "managed", hasAccess: true })).toBe(true);
    MANAGED_ACCESS_KINDS.delete("managed");
  });
});
