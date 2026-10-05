import { describe, it, expect, vi } from "vitest";
import {
  accessDecision,
  hasActiveAccess,
  PERIOD_END_GRACE_MS,
  PAST_DUE_GRACE_MS,
} from "./access";

const NOW = Date.parse("2026-10-05T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const iso = (t) => new Date(t).toISOString();

const row = (o) => ({
  plan: "base",
  subscription_status: "inactive",
  stripe_subscription_id: null,
  trial_ends_at: null,
  current_period_end: null,
  ...o,
});

describe("accessDecision: today's real account shapes (2026-10-05)", () => {
  it.each([
    ["dominickjerell (comped 2099)", { subscription_status: "active", plan: "unlimited", trial_ends_at: "2099-12-31T23:59:59Z" }],
    ["dominickhillprojects (comped 2126)", { subscription_status: "active", plan: "unlimited", trial_ends_at: "2126-06-17T01:04:26Z" }],
    ["highflyinnick (comped 2099)", { subscription_status: "active", plan: "unlimited", trial_ends_at: "2099-12-31T23:59:59Z" }],
    ["dominickh050 (comped to 2027-04-15)", { subscription_status: "active", plan: "unlimited", trial_ends_at: "2027-04-15T05:03:53Z" }],
  ])("%s keeps access", (_l, o) => {
    expect(accessDecision(row(o), NOW)).toMatchObject({ hasAccess: true, kind: "comped" });
  });

  it("Evans: active Stripe sub with a pending cancel keeps access until the period ends", () => {
    const evans = row({
      subscription_status: "active",
      stripe_subscription_id: "sub_1UJmun",
      trial_ends_at: "2026-10-02T16:24:10Z", // stale; Stripe owns the clock
      current_period_end: "2026-10-26T04:08:43Z",
    });
    expect(hasActiveAccess(evans, NOW)).toBe(true);
    expect(hasActiveAccess(evans, Date.parse("2026-10-28T00:00:00Z"))).toBe(false);
  });

  it("Evans before the backfill (no current_period_end): status decides", () => {
    expect(hasActiveAccess(row({ subscription_status: "active", stripe_subscription_id: "sub_1" }), NOW)).toBe(true);
  });

  it("jaguilar: canceled Stripe sub has no access", () => {
    expect(
      accessDecision(row({ subscription_status: "canceled", stripe_subscription_id: "sub_1TnE", trial_ends_at: "2026-07-04T17:14:06Z" }), NOW)
    ).toMatchObject({ hasAccess: false, reason: "canceled" });
  });

  it("Christian: legacy no-card trial until 2026-10-08 has access until then", () => {
    const c = row({ subscription_status: "trialing", trial_ends_at: "2026-10-08T18:41:52Z" });
    expect(accessDecision(c, NOW)).toMatchObject({ hasAccess: true, kind: "legacy_trial" });
    expect(accessDecision(c, Date.parse("2026-10-09T00:00:00Z"))).toMatchObject({
      hasAccess: false,
      reason: "legacy_trial_ended",
    });
  });

  it.each([
    ["bro2brotime", "2026-05-24T21:01:20Z"],
    ["gdkjvrkn123", "2026-06-19T02:48:04Z"],
    ["kultivateher", "2026-08-23T04:55:45Z"],
    ["juraj", "2026-09-03T23:10:29Z"],
    ["yanglaisong", "2026-09-09T03:19:17Z"],
  ])("%s: lapsed legacy trial has no access", (_l, end) => {
    expect(accessDecision(row({ subscription_status: "trialing", trial_ends_at: end }), NOW)).toMatchObject({
      hasAccess: false,
      reason: "legacy_trial_ended",
    });
  });
});

describe("accessDecision: Stripe-backed rules", () => {
  const sub = (o) => row({ stripe_subscription_id: "sub_x", ...o });

  it("Stripe trialing has access", () => {
    expect(hasActiveAccess(sub({ subscription_status: "trialing", current_period_end: iso(NOW + 5 * DAY) }), NOW)).toBe(true);
  });

  it("period end has a renewal grace, then denies", () => {
    const end = NOW - 2 * 60 * 60 * 1000; // ended 2h ago, renewal webhook pending
    expect(hasActiveAccess(sub({ subscription_status: "active", current_period_end: iso(end) }), NOW)).toBe(true);
    expect(
      accessDecision(sub({ subscription_status: "active", current_period_end: iso(NOW - PERIOD_END_GRACE_MS - 1000) }), NOW)
    ).toMatchObject({ hasAccess: false, reason: "period_ended" });
  });

  it("past_due keeps access while Stripe retries, not forever", () => {
    expect(hasActiveAccess(sub({ subscription_status: "past_due", current_period_end: iso(NOW - 3 * DAY) }), NOW)).toBe(true);
    expect(
      accessDecision(sub({ subscription_status: "past_due", current_period_end: iso(NOW - PAST_DUE_GRACE_MS - DAY) }), NOW)
    ).toMatchObject({ hasAccess: false, reason: "past_due_expired" });
  });

  it.each(["canceled", "unpaid", "incomplete", "incomplete_expired", "paused"])("%s has no access", (s) => {
    expect(hasActiveAccess(sub({ subscription_status: s, current_period_end: iso(NOW + DAY) }), NOW)).toBe(false);
  });
});

describe("accessDecision: everything else", () => {
  it("a new signup before Checkout (inactive) has no access", () => {
    expect(accessDecision(row({ subscription_status: "inactive" }), NOW)).toMatchObject({ hasAccess: false, kind: "none" });
  });

  it.each(["expired", "canceled", null])("no-subscription %s has no access", (s) => {
    expect(hasActiveAccess(row({ subscription_status: s }), NOW)).toBe(false);
  });

  it("a comp that ended has no access", () => {
    expect(accessDecision(row({ subscription_status: "active", trial_ends_at: iso(NOW - DAY) }), NOW)).toMatchObject({
      hasAccess: false,
      reason: "comp_ended",
    });
  });

  it("past_due without a subscription has no access", () => {
    expect(hasActiveAccess(row({ subscription_status: "past_due" }), NOW)).toBe(false);
  });

  it("fails closed, loudly, when a caller didn't select the columns", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(accessDecision({ plan: "unlimited", email: "x@y.z" }, NOW)).toMatchObject({
      hasAccess: false,
      reason: "missing_fields",
    });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("ignores onboarding_completed and email entirely", () => {
    const base = row({ subscription_status: "inactive" });
    expect(hasActiveAccess({ ...base, onboarding_completed: true, email: "dominickjerell@gmail.com" }, NOW)).toBe(false);
  });

  it("no user", () => {
    expect(hasActiveAccess(null, NOW)).toBe(false);
  });
});
