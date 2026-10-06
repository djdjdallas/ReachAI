import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fakeDb } from "@/lib/test-utils/stripe-fake-db";

// Side effects (analytics, alert emails, drip enrollment) run after the
// critical write, are individually caught and logged, and never cause a
// 500. Unlike route.test.js, the REAL analytics wrapper
// (src/lib/posthog-server.js) is used here; only the PostHog SDK under it
// is made to fail. Found in the sandbox run: checkout.session.completed
// returned 500 when the PostHog key was unset.

const stripe = {
  webhooks: { constructEvent: (body) => JSON.parse(body) },
  subscriptions: { retrieve: vi.fn(), list: vi.fn(async () => ({ data: [] })) },
};
vi.mock("@/lib/stripe", () => ({
  getStripe: () => stripe,
  PLANS: { base: { priceId: "price_base" }, unlimited: { priceId: "price_unl" } },
}));

let db;
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => db }));

const afterCallbacks = [];
vi.mock("next/server", () => ({
  NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) },
  // Collected, then run after the response like Next does.
  after: (fn) => afterCallbacks.push(fn),
}));

const posthogMode = { value: "ok" };
vi.mock("posthog-node", () => ({
  PostHog: function () {
    if (posthogMode.value === "ctor_throws") throw new Error("You must pass your PostHog project's api key.");
    return {
      capture: () => {
        if (posthogMode.value === "capture_throws") throw new Error("posthog down");
      },
    };
  },
}));

const sendBusinessEventAlert = vi.fn(async () => true);
vi.mock("@/lib/alerts/business-events", () => ({ sendBusinessEventAlert }));
const sendEmail = vi.fn(async () => ({ success: true }));
vi.mock("@/lib/notifications", () => ({ sendEmail }));
const recordTrialLedger = vi.fn(async () => {});
vi.mock("@/lib/billing/trial-policy", () => ({ recordTrialLedger }));

const user = (extra = {}) => ({
  id: "u1",
  email: "coach@example.com",
  stripe_customer_id: "cus_1",
  stripe_subscription_id: null,
  subscription_status: "inactive",
  plan: "base",
  ai_mode: "handoff",
  cancel_at: null,
  canceled_at: null,
  ...extra,
});

const checkout = (id) =>
  JSON.stringify({
    id,
    type: "checkout.session.completed",
    data: { object: { id: "cs_1", customer: "cus_1", subscription: "sub_1", metadata: { userId: "u1" }, amount_total: 0 } },
  });

async function post(body) {
  vi.resetModules(); // fresh analytics client per scenario
  const { POST } = await import("./route");
  return POST({ text: async () => body, headers: { get: () => "sig" } });
}

async function runAfter() {
  for (const fn of afterCallbacks.splice(0)) {
    try {
      await fn();
    } catch {
      // Next.js logs a failing after() callback; it never reaches the response.
    }
  }
}

let fetchSpy;
let errorSpy;
beforeEach(() => {
  vi.clearAllMocks();
  afterCallbacks.length = 0;
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = "phc_test";
  process.env.NEXT_PUBLIC_APP_URL = "http://app.test";
  stripe.subscriptions.retrieve.mockResolvedValue({
    id: "sub_1",
    customer: "cus_1",
    status: "trialing",
    trial_end: 1790600000,
    items: { data: [{ price: { id: "price_base" }, current_period_end: 1790600000 }] },
  });
  fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, status: 200 });
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
});

const ACTIVATED = {
  subscription_status: "trialing",
  stripe_subscription_id: "sub_1",
  plan: "base",
  current_period_end: new Date(1790600000 * 1000).toISOString(),
};

describe("Stripe webhook: side effects never cause a 500", () => {
  it.each([
    ["the PostHog key is unset", () => delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN],
    ["the PostHog client can't be constructed", () => (posthogMode.value = "ctor_throws")],
    ["PostHog capture throws", () => (posthogMode.value = "capture_throws")],
  ])("checkout.session.completed returns 200 with the row correct when %s", async (_label, breakPosthog) => {
    posthogMode.value = "ok";
    breakPosthog();
    db = fakeDb({ users: [user()] });

    const res = await post(checkout("evt_ph"));
    expect(res.status).toBe(200);
    expect(db.tables.users[0]).toMatchObject(ACTIVATED);
    expect(db.tables.stripe_webhook_events[0]).toMatchObject({ event_id: "evt_ph", status: "done" });
    expect(recordTrialLedger).toHaveBeenCalledTimes(1);

    // The other side effects still run.
    await runAfter();
    expect(sendBusinessEventAlert).toHaveBeenCalledWith("subscription_started", expect.objectContaining({ email: "coach@example.com" }));
    expect(fetchSpy).toHaveBeenCalledWith("http://app.test/api/drip/enroll", expect.anything());
  });

  it("an alert that rejects and a drip enrollment that fails are logged, not a 500", async () => {
    posthogMode.value = "ok";
    sendBusinessEventAlert.mockRejectedValueOnce(new Error("resend down"));
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 401 });
    db = fakeDb({ users: [user()] });

    const res = await post(checkout("evt_alerts"));
    expect(res.status).toBe(200);
    expect(db.tables.users[0]).toMatchObject(ACTIVATED);
    await runAfter();
    expect(errorSpy).toHaveBeenCalledWith("[stripe-webhook] drip enrollment failed:", 401, "user:", "u1");
  });

  it("a drip enrollment network error is logged, not a 500", async () => {
    posthogMode.value = "ok";
    fetchSpy.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    db = fakeDb({ users: [user()] });
    expect((await post(checkout("evt_drip"))).status).toBe(200);
    await runAfter();
    expect(errorSpy).toHaveBeenCalledWith("[stripe-webhook] drip enrollment failed:", "ECONNREFUSED", "user:", "u1");
  });

  it("subscription.deleted with PostHog throwing still cancels the row and alerts", async () => {
    posthogMode.value = "capture_throws";
    db = fakeDb({ users: [user({ subscription_status: "active", stripe_subscription_id: "sub_1", plan: "unlimited", ai_mode: "active" })], conversations: [], dm_drip_queue: [] });
    const res = await post(
      JSON.stringify({ id: "evt_del", type: "customer.subscription.deleted", data: { object: { id: "sub_1", customer: "cus_1" } } })
    );
    expect(res.status).toBe(200);
    expect(db.tables.users[0]).toMatchObject({ subscription_status: "canceled", plan: "base", ai_mode: "off" });
    await runAfter();
    expect(sendBusinessEventAlert).toHaveBeenCalledWith("subscription_canceled", expect.anything());
  });
});
