import { describe, it, expect } from "vitest";
import { subscriptionSummary } from "./SubscriptionCards";

const p = (o) => ({ plan: "unlimited", subscription_status: "active", ...o });

describe("Settings subscription summary", () => {
  it("comped: complimentary, no billing link", () => {
    expect(subscriptionSummary(p({}), { kind: "comped", hasAccess: true })).toMatchObject({
      title: "Complimentary plan",
      showManage: false,
    });
  });

  it("ended comp: no longer complimentary, offers a plan", () => {
    expect(subscriptionSummary(p({}), { kind: "comped", hasAccess: false, reason: "comp_ended" })).toMatchObject({
      title: "No active plan",
      choosePlan: true,
    });
  });

  it("Stripe trial: trial end and first charge", () => {
    const s = subscriptionSummary(p({ subscription_status: "trialing", trial_ends_at: "2026-10-13T12:00:00Z" }), {
      kind: "stripe",
      hasAccess: true,
    });
    expect(s.title).toBe("Unlimited Plan, Free trial");
    expect(s.detail).toMatch(/^Trial ends October 13, 2026\. Your first charge is on that date\.$/);
  });

  it("active: next billing date", () => {
    expect(
      subscriptionSummary(p({ current_period_end: "2026-11-06T12:00:00Z" }), { kind: "stripe", hasAccess: true }).detail
    ).toBe("Next billing date: November 6, 2026.");
  });

  it("pending cancel wins: cancels on <date>", () => {
    expect(
      subscriptionSummary(p({ cancel_at: "2026-10-26T12:00:00Z", current_period_end: "2026-10-26T12:00:00Z" }), {
        kind: "stripe",
        hasAccess: true,
      }).detail
    ).toBe("Cancels on October 26, 2026.");
  });

  it("past due: prompts a card update", () => {
    expect(subscriptionSummary(p({ subscription_status: "past_due" }), { kind: "stripe", hasAccess: true })).toMatchObject({
      pastDue: true,
      showManage: true,
    });
  });

  it("legacy no-card trial", () => {
    expect(
      subscriptionSummary(p({ plan: "base", subscription_status: "trialing", trial_ends_at: "2026-10-08T18:41:52Z" }), {
        kind: "legacy_trial",
        hasAccess: true,
      })
    ).toMatchObject({ title: "Base Plan, free trial", detail: "Your free trial ends October 8, 2026." });
  });

  it("no plan: points to plan selection", () => {
    expect(subscriptionSummary(p({ subscription_status: "inactive" }), { kind: "none", hasAccess: false })).toMatchObject({
      title: "No active plan",
      choosePlan: true,
    });
  });

  it("nothing until the server's answer arrives", () => {
    expect(subscriptionSummary(p({}), null)).toBeNull();
  });
});
