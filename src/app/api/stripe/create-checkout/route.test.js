import { describe, it, expect, vi, beforeEach } from "vitest";

// create-checkout refuses comped / managed accounts server-side, before
// any Stripe call (audit Medium, 2026-10-05). /billing hides the buttons;
// this is the rule a stale page or a hand-made request can't get around.

let row;
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1", email: "coach@example.com" } }, error: null }) },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: row, error: null }) }) }) }),
  }),
}));

const stripe = { subscriptions: { list: vi.fn(async () => ({ data: [] })) } };
const createCheckoutSession = vi.fn(async () => ({ url: "https://checkout.stripe.com/c/pay/cs_test_x" }));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => stripe,
  createCheckoutSession,
  createCustomerPortalSession: vi.fn(),
  planForCheckout: (id) => (id === "base" ? { priceId: "price_base", price: 9700 } : null),
}));
const ensureStripeCustomer = vi.fn(async () => "cus_1");
vi.mock("@/lib/billing/customer", () => ({ ensureStripeCustomer }));
vi.mock("@/lib/billing/trial-policy", () => ({ decideCheckoutTrial: async () => ({ mode: "trial", trialPeriodDays: 7 }) }));

const { POST, MANAGED_ACCOUNT_MESSAGE } = await import("./route");
const req = (body) => ({ json: async () => body });

const NOW = Date.now();
const comped = {
  email: "founder@example.com",
  plan: "unlimited",
  subscription_status: "active",
  stripe_subscription_id: null,
  trial_ends_at: "2099-12-31T00:00:00Z",
  current_period_end: null,
};

beforeEach(() => vi.clearAllMocks());

describe("POST /api/stripe/create-checkout", () => {
  it("a comped account gets a clear 409 and nothing happens in Stripe", async () => {
    row = comped;
    const res = await POST(req({ planId: "base", returnTo: "billing" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "managed_account", message: MANAGED_ACCOUNT_MESSAGE });
    expect(MANAGED_ACCOUNT_MESSAGE).toBe(
      "Your plan is complimentary, so there's nothing to buy. Questions? Email dom@clinchd.io."
    );
    expect(ensureStripeCustomer).not.toHaveBeenCalled();
    expect(stripe.subscriptions.list).not.toHaveBeenCalled();
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it.each([
    ["a new account (no access yet)", { email: "new@example.com", plan: "base", subscription_status: "inactive", stripe_subscription_id: null, trial_ends_at: null, current_period_end: null }],
    ["a legacy no-card trial", { email: "legacy@example.com", plan: "base", subscription_status: "trialing", stripe_subscription_id: null, trial_ends_at: new Date(NOW + 4 * 86_400_000).toISOString(), current_period_end: null }],
    ["a canceled subscriber", { email: "back@example.com", plan: "base", subscription_status: "canceled", stripe_subscription_id: "sub_old", trial_ends_at: null, current_period_end: null }],
  ])("%s still gets Checkout", async (_label, r) => {
    row = r;
    const res = await POST(req({ planId: "base" }));
    expect(res.status).toBe(200);
    expect((await res.json()).url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
    expect(createCheckoutSession).toHaveBeenCalledTimes(1);
  });

  it("an expired comp (trial_ends_at in the past) is not managed: it can buy a plan", async () => {
    row = { ...comped, trial_ends_at: new Date(NOW - 86_400_000).toISOString() };
    const res = await POST(req({ planId: "base" }));
    expect(res.status).toBe(200);
  });
});
