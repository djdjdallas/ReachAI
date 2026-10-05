import { describe, it, expect } from "vitest";
import { subscriptionFields, ENDED_STATUSES, SERVING_STRIPE_STATUSES } from "./subscription-sync";

const planFromPriceId = (id) => ({ price_base: "base", price_unl: "unlimited" })[id] ?? null;

describe("subscriptionFields", () => {
  it("maps a live trialing subscription, status as Stripe reports it", () => {
    expect(
      subscriptionFields(
        {
          id: "sub_1",
          status: "trialing",
          trial_end: 1790000000,
          items: { data: [{ price: { id: "price_unl" }, current_period_end: 1790000000 }] },
        },
        planFromPriceId
      )
    ).toEqual({
      subscription_status: "trialing",
      stripe_subscription_id: "sub_1",
      plan: "unlimited",
      current_period_end: new Date(1790000000 * 1000).toISOString(),
      trial_ends_at: new Date(1790000000 * 1000).toISOString(),
    });
  });

  it("falls back to a top-level current_period_end (older API shape)", () => {
    expect(subscriptionFields({ id: "s", status: "active", current_period_end: 1790000000 }, planFromPriceId).current_period_end).toBe(
      new Date(1790000000 * 1000).toISOString()
    );
  });

  it("leaves plan and trial_ends_at alone when unknown", () => {
    const f = subscriptionFields({ id: "s", status: "unpaid", items: { data: [{ price: { id: "price_other" } }] } }, planFromPriceId);
    expect(f).not.toHaveProperty("plan");
    expect(f).not.toHaveProperty("trial_ends_at");
    expect(f.subscription_status).toBe("unpaid");
  });

  it("status sets", () => {
    expect([...ENDED_STATUSES].sort()).toEqual(["canceled", "incomplete_expired", "unpaid"]);
    expect(SERVING_STRIPE_STATUSES.has("trialing")).toBe(true);
    expect(SERVING_STRIPE_STATUSES.has("unpaid")).toBe(false);
  });
});
