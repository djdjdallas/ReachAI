import { describe, it, expect } from "vitest";
import {
  inactiveGate,
  missedLeadsText,
  countMissedLeads,
  inactiveSentinelReason,
} from "./inactive-inbound";

const NOW = Date.parse("2026-10-01T12:00:00Z");

describe("inactiveGate (delegates to hasActiveAccess)", () => {
  const paying = (o) => ({
    plan: "base",
    subscription_status: "active",
    stripe_subscription_id: "sub_1",
    trial_ends_at: null,
    current_period_end: "2026-10-20T00:00:00Z",
    ...o,
  });

  it.each(["active", "trialing", "past_due"])("serves a Stripe-backed %s account", (subscription_status) => {
    expect(inactiveGate(paying({ subscription_status }), NOW)).toBeNull();
  });

  it("serves a legacy no-card trial that hasn't ended", () => {
    expect(
      inactiveGate(paying({ subscription_status: "trialing", stripe_subscription_id: null, trial_ends_at: "2026-10-02T00:00:00Z" }), NOW)
    ).toBeNull();
  });

  it("blocks a lapsed legacy trial with the trial_expired reason, and never asks for a flip", () => {
    expect(
      inactiveGate(paying({ subscription_status: "trialing", stripe_subscription_id: null, trial_ends_at: "2026-09-30T00:00:00Z" }), NOW)
    ).toEqual({ reason: "trial_expired" });
  });

  it.each(["expired", "canceled", "unpaid", null])("blocks %s as subscription_inactive", (subscription_status) => {
    expect(inactiveGate(paying({ subscription_status }), NOW)).toEqual({ reason: "subscription_inactive" });
  });

  it("serves a comped account", () => {
    expect(
      inactiveGate(paying({ stripe_subscription_id: null, trial_ends_at: "2099-12-31T00:00:00Z" }), NOW)
    ).toBeNull();
  });
});

describe("missedLeadsText", () => {
  it("expired copy", () => {
    expect(missedLeadsText(12, "expired")).toBe(
      "12 leads messaged you since your trial ended. Turn your AI back on to reply automatically."
    );
  });

  it("canceled copy says the plan ended, not the trial", () => {
    expect(missedLeadsText(3, "canceled")).toBe(
      "3 leads messaged you since your plan ended. Turn your AI back on to reply automatically."
    );
  });

  it("singular", () => {
    expect(missedLeadsText(1, "expired")).toMatch(/^1 lead messaged you /);
  });

  it("nothing to show at zero", () => {
    expect(missedLeadsText(0, "expired")).toBeNull();
  });

  it("has no long dashes", () => {
    expect(missedLeadsText(5, "expired") + missedLeadsText(5, "canceled")).not.toMatch(/[–—]/);
  });
});

describe("countMissedLeads", () => {
  function client(result) {
    const calls = [];
    const b = {
      select: (...a) => (calls.push(["select", ...a]), b),
      eq: (...a) => (calls.push(["eq", ...a]), b),
      in: (...a) => (calls.push(["in", ...a]), b),
      then: (resolve) => resolve(result),
    };
    return { calls, from: (t) => (calls.push(["from", t]), b) };
  }

  it("counts this owner's threads whose last turn the gate skipped", async () => {
    const c = client({ count: 481, error: null });
    expect(await countMissedLeads(c, "user-1")).toBe(481);
    expect(c.calls).toContainEqual(["from", "conversations"]);
    expect(c.calls).toContainEqual(["eq", "user_id", "user-1"]);
    expect(c.calls).toContainEqual(["in", "last_skip_reason", ["subscription_inactive", "trial_expired"]]);
  });

  it("hides the notice on error", async () => {
    expect(await countMissedLeads(client({ count: null, error: { message: "x" } }), "u")).toBe(0);
  });
});

describe("inactiveSentinelReason", () => {
  it("names the gate", () => {
    expect(inactiveSentinelReason("subscription_inactive")).toBe(
      "gated before classification: subscription_inactive"
    );
  });
});
