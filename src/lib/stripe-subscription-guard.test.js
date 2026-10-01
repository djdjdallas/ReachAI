import { describe, it, expect } from "vitest";
import {
  mapSubscriptionStatus,
  decideSubscriptionUpdate,
  shouldActivateCheckout,
  shouldApplyDeletion,
  CLEAR_PENDING_CANCEL,
} from "./stripe-subscription-guard";

const SUB = "sub_current";

describe("mapSubscriptionStatus", () => {
  it.each([
    ["active", "active"],
    ["trialing", "active"],
    ["past_due", "past_due"],
    ["canceled", "canceled"],
    ["unpaid", "canceled"],
    ["incomplete", "incomplete"],
  ])("%s → %s", (stripe, ours) => {
    expect(mapSubscriptionStatus(stripe)).toBe(ours);
  });
});

describe("decideSubscriptionUpdate (H2)", () => {
  const active = { subscription_status: "active", stripe_subscription_id: SUB };
  const canceled = { subscription_status: "canceled", stripe_subscription_id: SUB };

  it("applies a normal update for the tracked subscription", () => {
    expect(decideSubscriptionUpdate({ row: active, subscriptionId: SUB, liveStatus: "active" }).apply).toBe(true);
  });

  it("skips an event for a subscription the row no longer tracks", () => {
    expect(
      decideSubscriptionUpdate({ row: active, subscriptionId: "sub_old", liveStatus: "active" })
    ).toEqual({ apply: false, reason: "other_subscription" });
  });

  it("does not resurrect a canceled row from a stale 'active' delivery (Stripe says canceled)", () => {
    // The retried cancel-request event (payload status 'active') lands after
    // customer.subscription.deleted. The handler passes the LIVE status.
    expect(
      decideSubscriptionUpdate({ row: canceled, subscriptionId: SUB, liveStatus: "canceled" })
    ).toEqual({ apply: false, reason: "already_canceled" });
  });

  it("lets the tracked subscription recover from unpaid when Stripe confirms it", () => {
    expect(decideSubscriptionUpdate({ row: canceled, subscriptionId: SUB, liveStatus: "active" }).apply).toBe(true);
  });

  it("will not reactivate a canceled row it cannot tie to the subscription", () => {
    expect(
      decideSubscriptionUpdate({
        row: { subscription_status: "canceled", stripe_subscription_id: null },
        subscriptionId: SUB,
        liveStatus: "active",
      })
    ).toEqual({ apply: false, reason: "canceled_row_unverified" });
  });

  it("applies when the row has no subscription id yet (first subscription)", () => {
    expect(
      decideSubscriptionUpdate({
        row: { subscription_status: "trialing", stripe_subscription_id: null },
        subscriptionId: SUB,
        liveStatus: "trialing",
      }).apply
    ).toBe(true);
  });

  it("skips when no row matches the customer", () => {
    expect(decideSubscriptionUpdate({ row: null, subscriptionId: SUB, liveStatus: "active" }).apply).toBe(false);
  });
});

describe("shouldActivateCheckout (H2)", () => {
  it.each(["active", "trialing", "past_due", "incomplete"])("activates for a live %s subscription", (s) => {
    expect(shouldActivateCheckout(s)).toBe(true);
  });

  it.each(["canceled", "incomplete_expired"])("ignores a replay after the subscription ended (%s)", (s) => {
    expect(shouldActivateCheckout(s)).toBe(false);
  });
});

describe("shouldApplyDeletion", () => {
  it("cancels the tracked subscription", () => {
    expect(shouldApplyDeletion({ row: { stripe_subscription_id: SUB }, subscriptionId: SUB })).toBe(true);
  });

  it("ignores a late delete of the old subscription after a resubscribe", () => {
    expect(shouldApplyDeletion({ row: { stripe_subscription_id: SUB }, subscriptionId: "sub_old" })).toBe(false);
  });

  it("cancels when the row never recorded a subscription id", () => {
    expect(shouldApplyDeletion({ row: { stripe_subscription_id: null }, subscriptionId: SUB })).toBe(true);
  });
});

describe("CLEAR_PENDING_CANCEL (M2)", () => {
  it("nulls both pending-cancel columns", () => {
    expect(CLEAR_PENDING_CANCEL).toEqual({ cancel_at: null, canceled_at: null });
  });
});
