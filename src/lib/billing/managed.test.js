import { describe, it, expect } from "vitest";
import { billingPageView, isManagedAccount, managedPlanTitle, MANAGED_ACCESS_KINDS } from "./managed";

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

  it("managed (billed outside Clinchd) is a managed kind: no price, portal or plan buttons", () => {
    expect([...MANAGED_ACCESS_KINDS]).toEqual(["comped", "managed"]);
    const access = { kind: "managed", hasAccess: true, reason: "managed" };
    expect(isManagedAccount(access)).toBe(true);
    expect(billingPageView({ access, hasStripeCustomer: true })).toMatchObject({
      managed: true,
      showPrice: false,
      showPortal: false,
      showPlanButtons: false,
    });
  });

  it("titles: managed plan vs complimentary plan", () => {
    expect(managedPlanTitle({ kind: "managed", hasAccess: true })).toBe("Managed plan");
    expect(managedPlanTitle({ kind: "comped", hasAccess: true })).toBe("Complimentary plan");
  });
});
