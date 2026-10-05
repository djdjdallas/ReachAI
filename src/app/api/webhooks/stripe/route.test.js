import { describe, it, expect, vi, beforeEach } from "vitest";

// Route-level tests for the Stripe webhook: the handler runs for real, with
// Stripe, Supabase and the side-effect modules stubbed. The fake client lives
// here rather than in test-utils/fake-supabase.js because it needs reads,
// .or() filters and injected errors that the shared helper does not.

const stripe = {
  webhooks: { constructEvent: (body) => JSON.parse(body) },
  subscriptions: { retrieve: vi.fn(), list: vi.fn(), cancel: vi.fn() },
  invoices: { list: vi.fn() },
  invoicePayments: { list: vi.fn() },
  refunds: { create: vi.fn() },
  checkout: {
    sessions: { listLineItems: vi.fn(async () => ({ data: [{ price: { id: "price_unl" } }] })) },
  },
};
vi.mock("@/lib/stripe", () => ({
  getStripe: () => stripe,
  PLANS: { base: { priceId: "price_base" }, unlimited: { priceId: "price_unl" } },
}));

let db;
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => db }));

vi.mock("next/server", () => ({
  NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) },
  after: (fn) => fn(),
}));

const capture = vi.fn();
vi.mock("@/lib/posthog-server", () => ({ getPostHogClient: () => ({ capture }) }));
const sendBusinessEventAlert = vi.fn(async () => true);
vi.mock("@/lib/alerts/business-events", () => ({ sendBusinessEventAlert }));
vi.mock("@/lib/notifications", () => ({ sendEmail: vi.fn(async () => ({})) }));
const recordTrialLedger = vi.fn(async () => {});
vi.mock("@/lib/billing/trial-policy", () => ({ recordTrialLedger }));

const { POST } = await import("./route");

// Minimal supabase-js stand-in. Every query applies its filters and writes in
// one synchronous step, the way a single UPDATE ... WHERE is atomic in
// Postgres. `failOn` injects an error for a given table + operation (a
// message, or a function of the update data returning one);
// `afterRead` runs once after the first users read, to model a concurrent
// write landing between the handler's read and its UPDATE.
function fakeDb(tables, { failOn = {}, afterRead } = {}) {
  let readHook = afterRead;
  const parseOr = (expr) =>
    expr.split(",").map((part) => {
      const [col, op, ...rest] = part.split(".");
      const val = rest.join(".");
      return (row) =>
        op === "is" && val === "null" ? (row[col] ?? null) === null : op === "eq" && row[col] === val;
    });
  const matches = (row, filters) =>
    filters.every(([op, col, val]) => {
      if (op === "eq") return row[col] === val;
      if (op === "neq") return row[col] !== val;
      if (op === "is") return (row[col] ?? null) === val;
      if (op === "notnull") return (row[col] ?? null) !== null;
      if (op === "lt") return row[col] != null && row[col] < val;
      if (op === "or") return parseOr(col).some((m) => m(row));
      throw new Error(`unsupported filter ${op}`);
    });

  return {
    tables,
    from(table) {
      const rows = (tables[table] ||= []);
      const query = (kind, data) => {
        const filters = [];
        let single = false;
        let selected = kind === "select";
        const run = () => {
          const rule = failOn[`${table}.${kind}`];
          const failure = typeof rule === "function" ? rule(data) : rule;
          if (failure) return { data: null, error: { message: failure } };
          const hit = rows.filter((r) => matches(r, filters));
          if (kind === "update") for (const r of hit) Object.assign(r, data);
          if (kind === "delete") {
            for (const r of hit) rows.splice(rows.indexOf(r), 1);
            return { data: null, error: null };
          }
          if (kind === "select" && table === "users" && readHook) {
            const snapshot = hit.map((r) => ({ ...r }));
            readHook(tables);
            readHook = null;
            return { data: single ? snapshot[0] ?? null : snapshot, error: null, count: hit.length };
          }
          const out = selected ? hit.map((r) => ({ ...r })) : null;
          return { data: single ? out?.[0] ?? null : out, error: null, count: hit.length };
        };
        const b = {
          eq: (c, v) => (filters.push(["eq", c, v]), b),
          neq: (c, v) => (filters.push(["neq", c, v]), b),
          is: (c, v) => (filters.push(["is", c, v]), b),
          lt: (c, v) => (filters.push(["lt", c, v]), b),
          not: (c, _op, _v) => (filters.push(["notnull", c]), b),
          or: (expr) => (filters.push(["or", expr]), b),
          select: () => ((selected = true), b),
          maybeSingle: () => ((single = true), Promise.resolve(run())),
          single: () => ((single = true), Promise.resolve(run())),
          then: (resolve, reject) => Promise.resolve(run()).then(resolve, reject),
        };
        return b;
      };
      return {
        select: () => query("select"),
        update: (data) => query("update", data),
        delete: () => query("delete"),
        // insert ... on conflict do nothing: returns only the rows inserted.
        upsert: (data, { onConflict } = {}) => {
          const rule = failOn[`${table}.upsert`];
          const list = Array.isArray(data) ? data : [data];
          const inserted = [];
          if (!rule) {
            for (const r of list) {
              if (!rows.some((x) => x[onConflict] === r[onConflict])) {
                rows.push({ ...r });
                inserted.push({ ...r });
              }
            }
          }
          const result = rule ? { data: null, error: { message: rule } } : { data: inserted, error: null };
          const b = { select: () => b, then: (res, rej) => Promise.resolve(result).then(res, rej) };
          return b;
        },
      };
    },
  };
}

let eventSeq = 0;
const post = (event) =>
  POST({
    text: async () => JSON.stringify({ id: event.id ?? `evt_${++eventSeq}`, ...event }),
    headers: { get: () => "sig" },
  });

const user = (extra = {}) => ({
  id: "u1",
  email: "coach@example.com",
  instagram_username: "coachig",
  stripe_customer_id: "cus_1",
  stripe_subscription_id: "sub_new",
  subscription_status: "active",
  plan: "unlimited",
  ai_mode: "active",
  cancel_at: null,
  canceled_at: null,
  created_at: "2026-09-01T00:00:00.000Z",
  ...extra,
});

const deleted = (subId) => ({
  type: "customer.subscription.deleted",
  data: { object: { id: subId, customer: "cus_1" } },
});

beforeEach(() => {
  vi.clearAllMocks();
  // Defaults: the customer has no other subscriptions, nothing to refund.
  stripe.subscriptions.list.mockResolvedValue({ data: [] });
  stripe.subscriptions.cancel.mockResolvedValue({ status: "canceled" });
  stripe.invoices.list.mockResolvedValue({ data: [] });
  stripe.invoicePayments.list.mockResolvedValue({ data: [] });
  stripe.refunds.create.mockResolvedValue({ id: "re_1", amount: 19700, currency: "usd" });
  recordTrialLedger.mockResolvedValue(undefined);
});

describe("customer.subscription.deleted (M1)", () => {
  it("a late delete for the old subscription after a resubscribe leaves the user active", async () => {
    db = fakeDb({ users: [user()], dm_drip_queue: [{ user_id: "u1", status: "scheduled" }] });
    const res = await post(deleted("sub_old"));
    expect(res.status).toBe(200);
    expect(db.tables.users[0]).toMatchObject({
      subscription_status: "active",
      plan: "unlimited",
      ai_mode: "active",
    });
    expect(db.tables.dm_drip_queue[0].status).toBe("scheduled");
    expect(sendBusinessEventAlert).not.toHaveBeenCalled();
  });

  it("still leaves the user active when the resubscribe lands between the read and the UPDATE", async () => {
    // The read sees the old subscription (the JS guard alone would pass);
    // checkout writes sub_new before the UPDATE runs. The guard in the
    // UPDATE's WHERE is what saves the row.
    db = fakeDb(
      { users: [user({ stripe_subscription_id: "sub_old", subscription_status: "canceled" })] },
      {
        afterRead: (t) =>
          Object.assign(t.users[0], { stripe_subscription_id: "sub_new", subscription_status: "active" }),
      }
    );
    const res = await post(deleted("sub_old"));
    expect(res.status).toBe(200);
    expect(db.tables.users[0]).toMatchObject({ subscription_status: "active", plan: "unlimited" });
  });

  it("cancels the subscription the row tracks", async () => {
    db = fakeDb({ users: [user({ cancel_at: "2026-10-26T04:08:43.000Z" })], dm_drip_queue: [] });
    const res = await post(deleted("sub_new"));
    expect(res.status).toBe(200);
    expect(db.tables.users[0]).toMatchObject({
      subscription_status: "canceled",
      plan: "base",
      ai_mode: "off",
      cancel_at: null,
    });
    expect(sendBusinessEventAlert).toHaveBeenCalledWith(
      "subscription_canceled",
      expect.objectContaining({ plan: "unlimited" })
    );
  });

  it("a user read error returns 500 and changes nothing", async () => {
    db = fakeDb({ users: [user()] }, { failOn: { "users.select": "connection reset" } });
    const res = await post(deleted("sub_new"));
    expect(res.status).toBe(500);
    expect(db.tables.users[0].subscription_status).toBe("active");
  });
});

describe("customer.subscription.updated (M2)", () => {
  const updated = { type: "customer.subscription.updated", data: { object: { id: "sub_new", customer: "cus_1" } } };

  beforeEach(() => {
    stripe.subscriptions.retrieve.mockResolvedValue({
      id: "sub_new",
      status: "active",
      cancel_at: 1792987723,
      items: { data: [{ price: { id: "price_unl" } }] },
    });
  });

  it("a user read error returns 500 so Stripe retries", async () => {
    db = fakeDb({ users: [user()] }, { failOn: { "users.select": "connection reset" } });
    const res = await post(updated);
    expect(res.status).toBe(500);
    expect(db.tables.users[0].cancel_at).toBeNull();
  });

  it("a main update error returns 500", async () => {
    // Fails only the status/plan write; the pending-cancel write would succeed.
    db = fakeDb(
      { users: [user()] },
      { failOn: { "users.update": (data) => ("subscription_status" in data ? "statement timeout" : null) } }
    );
    const res = await post(updated);
    expect(res.status).toBe(500);
  });

  it("an update for the old subscription that races a resubscribe leaves the new one alone", async () => {
    // The read sees sub_new's predecessor as tracked, so decideSubscriptionUpdate
    // applies; checkout writes sub_new before the UPDATE runs. The guard in the
    // UPDATE's WHERE keeps the stale event off the row, cancel fields included.
    stripe.subscriptions.retrieve.mockResolvedValue({
      id: "sub_old",
      status: "active",
      cancel_at: 1792987723,
      items: { data: [{ price: { id: "price_base" } }] },
    });
    db = fakeDb(
      { users: [user({ stripe_subscription_id: "sub_old", plan: "unlimited" })] },
      { afterRead: (t) => Object.assign(t.users[0], { stripe_subscription_id: "sub_new" }) }
    );
    const res = await post({
      type: "customer.subscription.updated",
      data: { object: { id: "sub_old", customer: "cus_1" } },
    });
    expect(res.status).toBe(200);
    expect(db.tables.users[0]).toMatchObject({
      stripe_subscription_id: "sub_new",
      plan: "unlimited",
      cancel_at: null,
    });
    expect(sendBusinessEventAlert).not.toHaveBeenCalled();
  });

  it("applies a cancel request when the read and write succeed", async () => {
    db = fakeDb({ users: [user()] });
    const res = await post(updated);
    expect(res.status).toBe(200);
    expect(db.tables.users[0].cancel_at).toBe(new Date(1792987723 * 1000).toISOString());
    expect(sendBusinessEventAlert).toHaveBeenCalledWith("cancellation_requested", expect.any(Object));
  });
});

describe("checkout.session.completed (M3)", () => {
  const checkout = {
    type: "checkout.session.completed",
    data: { object: { id: "cs_1", customer: "cus_1", subscription: "sub_new", metadata: { userId: "u1" } } },
  };

  it.each(["unpaid", "past_due", "canceled", "paused"])(
    "a replay for a %s subscription does not write 'active'",
    async (status) => {
      stripe.subscriptions.retrieve.mockResolvedValue({ id: "sub_new", status });
      db = fakeDb({ users: [user({ subscription_status: "canceled", plan: "base", ai_mode: "off" })] });
      const res = await post(checkout);
      expect(res.status).toBe(200);
      expect(db.tables.users[0]).toMatchObject({ subscription_status: "canceled", ai_mode: "off" });
    }
  );

  it.each(["active", "trialing"])("activates for a live %s subscription, storing Stripe's own status", async (status) => {
    stripe.subscriptions.retrieve.mockResolvedValue({
      id: "sub_new",
      status,
      items: { data: [{ price: { id: "price_unl" }, current_period_end: 1792987723 }] },
    });
    db = fakeDb({
      users: [user({ subscription_status: "canceled", stripe_subscription_id: "sub_old", plan: "base", ai_mode: "off", cancel_at: "2026-08-01T00:00:00.000Z" })],
    });
    const res = await post(checkout);
    expect(res.status).toBe(200);
    expect(db.tables.users[0]).toMatchObject({
      // Stored as Stripe reports it: a card-required trial is 'trialing'.
      subscription_status: status,
      stripe_subscription_id: "sub_new",
      plan: "unlimited",
      current_period_end: new Date(1792987723 * 1000).toISOString(),
      ai_mode: "active",
      cancel_at: null,
    });
    expect(recordTrialLedger).toHaveBeenCalledWith(expect.anything(), {
      email: "coach@example.com",
      stripeCustomerId: "cus_1",
      source: "stripe_checkout",
    });
  });

  it("a Stripe lookup failure returns 500 and activates nothing", async () => {
    stripe.subscriptions.retrieve.mockRejectedValue(new Error("rate limited"));
    db = fakeDb({ users: [user({ subscription_status: "canceled" })] });
    const res = await post(checkout);
    expect(res.status).toBe(500);
    expect(db.tables.users[0].subscription_status).toBe("canceled");
  });
});

describe("idempotency (stripe_webhook_events)", () => {
  const cancelReq = {
    id: "evt_cancel_1",
    type: "customer.subscription.updated",
    data: { object: { id: "sub_new", customer: "cus_1" } },
  };

  beforeEach(() => {
    sendBusinessEventAlert.mockClear();
    stripe.subscriptions.retrieve.mockResolvedValue({
      id: "sub_new",
      status: "active",
      cancel_at: 1792987723,
      cancel_at_period_end: false,
      canceled_at: 1790437657,
      items: { data: [{ price: { id: "price_unl" }, current_period_end: 1792987723 }] },
    });
  });

  it("a redelivered event is acknowledged without processing: one alert, not two", async () => {
    db = fakeDb({ users: [user()] });
    const first = await post(cancelReq);
    const second = await post(cancelReq);
    expect(first.status).toBe(200);
    expect(second).toMatchObject({ status: 200, body: { received: true, duplicate: true } });
    expect(sendBusinessEventAlert).toHaveBeenCalledTimes(1);
    expect(db.tables.stripe_webhook_events).toHaveLength(1);
  });

  it("a failed event releases its claim so Stripe's retry processes it", async () => {
    db = fakeDb({ users: [user()] }, { failOn: { "users.select": "connection reset" } });
    const failed = await post(cancelReq);
    expect(failed.status).toBe(500);
    expect(db.tables.stripe_webhook_events).toHaveLength(0);

    db = fakeDb({ users: [user()] });
    const retried = await post(cancelReq);
    expect(retried.status).toBe(200);
    expect(sendBusinessEventAlert).toHaveBeenCalledWith("cancellation_requested", expect.any(Object));
  });

  it("if the events table is unavailable, the event is still processed", async () => {
    db = fakeDb({ users: [user()] }, { failOn: { "stripe_webhook_events.upsert": "relation does not exist" } });
    const res = await post(cancelReq);
    expect(res.status).toBe(200);
    expect(db.tables.users[0].cancel_at).toBe(new Date(1792987723 * 1000).toISOString());
  });
});

describe("customer.subscription.created and invoices sync from the live subscription", () => {
  beforeEach(() => {
    recordTrialLedger.mockClear();
  });

  it("a brand-new card-required signup becomes 'trialing' with its period end, and is recorded in the trial ledger", async () => {
    stripe.subscriptions.retrieve.mockResolvedValue({
      id: "sub_fresh",
      customer: "cus_1",
      status: "trialing",
      trial_end: 1790600000,
      items: { data: [{ price: { id: "price_base" }, current_period_end: 1790600000 }] },
    });
    db = fakeDb({
      users: [user({ subscription_status: "inactive", stripe_subscription_id: null, plan: "base", ai_mode: "handoff" })],
    });
    const res = await post({ type: "customer.subscription.created", data: { object: { id: "sub_fresh", customer: "cus_1" } } });
    expect(res.status).toBe(200);
    expect(db.tables.users[0]).toMatchObject({
      subscription_status: "trialing",
      stripe_subscription_id: "sub_fresh",
      plan: "base",
      current_period_end: new Date(1790600000 * 1000).toISOString(),
      trial_ends_at: new Date(1790600000 * 1000).toISOString(),
      ai_mode: "handoff", // an explicit handoff is never flipped
    });
    expect(recordTrialLedger).toHaveBeenCalledWith(expect.anything(), {
      email: "coach@example.com",
      stripeCustomerId: "cus_1",
      source: "stripe_subscription",
    });
  });

  it("invoice.payment_succeeded for a $0 trial invoice keeps 'trialing' (no hard-coded 'active')", async () => {
    stripe.subscriptions.retrieve.mockResolvedValue({
      id: "sub_new",
      customer: "cus_1",
      status: "trialing",
      items: { data: [{ price: { id: "price_unl" }, current_period_end: 1790600000 }] },
    });
    db = fakeDb({ users: [user({ subscription_status: "trialing" })] });
    await post({
      type: "invoice.payment_succeeded",
      data: { object: { customer: "cus_1", parent: { subscription_details: { subscription: "sub_new" } } } },
    });
    expect(db.tables.users[0].subscription_status).toBe("trialing");
  });

  it("trial converts to paid: the renewal invoice syncs 'active' and the new period end", async () => {
    stripe.subscriptions.retrieve.mockResolvedValue({
      id: "sub_new",
      customer: "cus_1",
      status: "active",
      items: { data: [{ price: { id: "price_unl" }, current_period_end: 1793200000 }] },
    });
    db = fakeDb({ users: [user({ subscription_status: "trialing" })] });
    await post({
      type: "invoice.payment_succeeded",
      data: { object: { customer: "cus_1", parent: { subscription_details: { subscription: "sub_new" } } } },
    });
    expect(db.tables.users[0]).toMatchObject({
      subscription_status: "active",
      current_period_end: new Date(1793200000 * 1000).toISOString(),
    });
  });
});

// ── Audit fixes (PR #51) ────────────────────────────────────────────────

const checkoutEvent = (session = {}) => ({
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_1",
      customer: "cus_1",
      subscription: "sub_new",
      metadata: { userId: "u1" },
      amount_total: 19700,
      ...session,
    },
  },
});

const liveSub = (extra = {}) => ({
  id: "sub_new",
  customer: "cus_1",
  status: "active",
  created: 1790000100,
  items: { data: [{ price: { id: "price_unl" }, current_period_end: 1792987723 }] },
  ...extra,
});

describe("M2: claim states (processing -> done, stale takeover)", () => {
  const evt = { id: "evt_m2", type: "customer.subscription.updated", data: { object: { id: "sub_new", customer: "cus_1" } } };
  const ago = (ms) => new Date(Date.now() - ms).toISOString();

  beforeEach(() => {
    stripe.subscriptions.retrieve.mockResolvedValue(liveSub({ cancel_at: 1792987723 }));
  });

  it("a processed event is marked done; a redelivery is a 200 duplicate", async () => {
    db = fakeDb({ users: [user()] });
    expect((await post(evt)).status).toBe(200);
    expect(db.tables.stripe_webhook_events[0]).toMatchObject({ event_id: "evt_m2", status: "done" });
    expect(db.tables.stripe_webhook_events[0].processed_at).toBeTruthy();
    expect(await post(evt)).toMatchObject({ status: 200, body: { duplicate: true } });
    expect(sendBusinessEventAlert).toHaveBeenCalledTimes(1);
  });

  it("a fresh 'processing' claim (another run owns it) gets 409 and is not processed", async () => {
    db = fakeDb({
      users: [user()],
      stripe_webhook_events: [{ event_id: "evt_m2", event_type: evt.type, status: "processing", claimed_at: ago(60_000) }],
    });
    const res = await post(evt);
    expect(res.status).toBe(409);
    expect(db.tables.users[0].cancel_at).toBeNull();
    expect(db.tables.stripe_webhook_events[0].status).toBe("processing");
  });

  it("a 'processing' claim older than 5 minutes is taken over and processed", async () => {
    db = fakeDb({
      users: [user()],
      stripe_webhook_events: [{ event_id: "evt_m2", event_type: evt.type, status: "processing", claimed_at: ago(6 * 60_000) }],
    });
    const res = await post(evt);
    expect(res.status).toBe(200);
    expect(db.tables.users[0].cancel_at).toBe(new Date(1792987723 * 1000).toISOString());
    expect(db.tables.stripe_webhook_events[0].status).toBe("done");
  });

  it("just under 5 minutes is still owned by the first run", async () => {
    db = fakeDb({
      users: [user()],
      stripe_webhook_events: [{ event_id: "evt_m2", event_type: evt.type, status: "processing", claimed_at: ago(4.5 * 60_000) }],
    });
    expect((await post(evt)).status).toBe(409);
  });

  it("a failed takeover run releases the claim for the next retry", async () => {
    db = fakeDb(
      {
        users: [user()],
        stripe_webhook_events: [{ event_id: "evt_m2", event_type: evt.type, status: "processing", claimed_at: ago(10 * 60_000) }],
      },
      { failOn: { "users.select": "connection reset" } }
    );
    expect((await post(evt)).status).toBe(500);
    expect(db.tables.stripe_webhook_events).toHaveLength(0);
  });
});

describe("M3: duplicate live subscription on one customer", () => {
  const older = liveSub({ id: "sub_old", created: 1790000000, items: { data: [{ price: { id: "price_base" }, current_period_end: 1792900000 }] } });

  it("the newer subscription is refunded, canceled, the row keeps the older one, and Dom is alerted", async () => {
    stripe.subscriptions.retrieve.mockResolvedValue(liveSub());
    stripe.subscriptions.list.mockResolvedValue({ data: [liveSub(), older] });
    stripe.invoices.list.mockResolvedValue({ data: [{ id: "in_2", amount_paid: 19700 }] });
    stripe.invoicePayments.list.mockResolvedValue({ data: [{ payment: { type: "payment_intent", payment_intent: "pi_2" } }] });
    // subscription.created for the duplicate landed first: the row tracks it.
    db = fakeDb({ users: [user({ stripe_subscription_id: "sub_new", plan: "unlimited" })] });

    const res = await post(checkoutEvent());
    expect(res.status).toBe(200);

    expect(stripe.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: "pi_2", reason: "duplicate" }),
      { idempotencyKey: "dup-sub-refund-pi_2" }
    );
    expect(stripe.subscriptions.cancel).toHaveBeenCalledWith(
      "sub_new",
      { prorate: false, invoice_now: false },
      { idempotencyKey: "dup-sub-cancel-sub_new" }
    );
    // Refund before cancel.
    expect(stripe.refunds.create.mock.invocationCallOrder[0]).toBeLessThan(
      stripe.subscriptions.cancel.mock.invocationCallOrder[0]
    );
    // Re-pointed to the kept subscription BEFORE the cancel, so the
    // duplicate's subscription.deleted matches no row.
    expect(db.tables.users[0]).toMatchObject({ stripe_subscription_id: "sub_old", plan: "base", voice_replies_enabled: false });
    expect(sendBusinessEventAlert).toHaveBeenCalledWith(
      "duplicate_subscription_canceled",
      expect.objectContaining({
        canceledSubscriptionId: "sub_new",
        keptSubscriptionId: "sub_old",
        refunds: [{ id: "re_1", amount: 19700, currency: "usd" }],
      })
    );
    expect(sendBusinessEventAlert).not.toHaveBeenCalledWith("subscription_started", expect.anything());
    expect(recordTrialLedger).not.toHaveBeenCalled();

    // The duplicate's deletion event now leaves the coach alone.
    await post(deleted("sub_new"));
    expect(db.tables.users[0]).toMatchObject({ subscription_status: "active", stripe_subscription_id: "sub_old" });
  });

  it("a trial duplicate has nothing to refund; it is still canceled", async () => {
    stripe.subscriptions.retrieve.mockResolvedValue(liveSub({ status: "trialing" }));
    stripe.subscriptions.list.mockResolvedValue({ data: [liveSub({ status: "trialing" }), older] });
    db = fakeDb({ users: [user({ stripe_subscription_id: "sub_old" })] });
    expect((await post(checkoutEvent())).status).toBe(200);
    expect(stripe.refunds.create).not.toHaveBeenCalled();
    expect(stripe.subscriptions.cancel).toHaveBeenCalledWith("sub_new", expect.anything(), expect.anything());
    expect(sendBusinessEventAlert).toHaveBeenCalledWith(
      "duplicate_subscription_canceled",
      expect.objectContaining({ refunds: [] })
    );
  });

  it("the OLDER subscription's checkout activates normally; it never cancels anything", async () => {
    stripe.subscriptions.retrieve.mockResolvedValue(older);
    stripe.subscriptions.list.mockResolvedValue({ data: [liveSub(), older] });
    db = fakeDb({ users: [user({ stripe_subscription_id: null, subscription_status: "inactive" })] });
    expect((await post(checkoutEvent({ subscription: "sub_old" }))).status).toBe(200);
    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
    expect(db.tables.users[0]).toMatchObject({ stripe_subscription_id: "sub_old", subscription_status: "active" });
  });

  it("an old canceled subscription is not a duplicate", async () => {
    stripe.subscriptions.retrieve.mockResolvedValue(liveSub());
    stripe.subscriptions.list.mockResolvedValue({ data: [liveSub(), { ...older, status: "canceled" }] });
    db = fakeDb({ users: [user({ stripe_subscription_id: "sub_old", subscription_status: "canceled" })] });
    expect((await post(checkoutEvent())).status).toBe(200);
    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
    expect(db.tables.users[0]).toMatchObject({ stripe_subscription_id: "sub_new", subscription_status: "active" });
  });

  it("a refund failure 500s before canceling; the retry repeats safely and finishes", async () => {
    stripe.subscriptions.retrieve.mockResolvedValue(liveSub());
    stripe.subscriptions.list.mockResolvedValue({ data: [liveSub(), older] });
    stripe.invoices.list.mockResolvedValue({ data: [{ id: "in_2", amount_paid: 19700 }] });
    stripe.invoicePayments.list.mockResolvedValue({ data: [{ payment: { payment_intent: "pi_2" } }] });
    stripe.refunds.create.mockRejectedValueOnce(new Error("api down"));
    db = fakeDb({ users: [user({ stripe_subscription_id: "sub_new" })] });
    const evt = { id: "evt_dup", ...checkoutEvent() };

    expect((await post(evt)).status).toBe(500);
    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
    expect(db.tables.stripe_webhook_events).toHaveLength(0);

    expect((await post(evt)).status).toBe(200);
    expect(stripe.refunds.create).toHaveBeenCalledTimes(2);
    expect(stripe.refunds.create.mock.calls[1][1]).toEqual({ idempotencyKey: "dup-sub-refund-pi_2" });
    expect(stripe.subscriptions.cancel).toHaveBeenCalledTimes(1);
  });
});

describe("L1: trial ledger failure makes Stripe retry", () => {
  it("a ledger write failure returns 500 and releases the claim; no alert or drip goes out", async () => {
    stripe.subscriptions.retrieve.mockResolvedValue(liveSub({ status: "trialing" }));
    recordTrialLedger.mockRejectedValueOnce(new Error("[trial-ledger] upsert failed: timeout"));
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true });
    db = fakeDb({ users: [user({ stripe_subscription_id: null, subscription_status: "inactive" })] });
    const evt = { id: "evt_l1", ...checkoutEvent() };

    expect((await post(evt)).status).toBe(500);
    expect(db.tables.stripe_webhook_events).toHaveLength(0);
    expect(sendBusinessEventAlert).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();

    // Retry: the ledger works, everything completes once.
    expect((await post(evt)).status).toBe(200);
    expect(recordTrialLedger).toHaveBeenCalledTimes(2);
    expect(sendBusinessEventAlert).toHaveBeenCalledWith("subscription_started", expect.anything());
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();
  });

  it("subscription.created: a ledger failure also 500s", async () => {
    stripe.subscriptions.retrieve.mockResolvedValue(liveSub({ status: "trialing" }));
    recordTrialLedger.mockRejectedValueOnce(new Error("TRIAL_LEDGER_SECRET is not set"));
    db = fakeDb({ users: [user({ stripe_subscription_id: null, subscription_status: "inactive" })] });
    const res = await post({ type: "customer.subscription.created", data: { object: { id: "sub_new", customer: "cus_1" } } });
    expect(res.status).toBe(500);
  });
});

describe("L2: checkout identity must match the row's Stripe customer", () => {
  beforeEach(() => {
    stripe.subscriptions.retrieve.mockResolvedValue(liveSub());
  });

  it("a client_reference_id naming someone else's row is ignored: nothing written, alert sent", async () => {
    // Attacker pays through a Payment Link with ?client_reference_id=<victim id>.
    db = fakeDb({ users: [user({ id: "victim", stripe_customer_id: "cus_victim", subscription_status: "inactive", stripe_subscription_id: null })] });
    const res = await post(checkoutEvent({ customer: "cus_attacker", metadata: {}, client_reference_id: "victim" }));
    expect(res.status).toBe(200);
    expect(db.tables.users[0]).toMatchObject({ stripe_customer_id: "cus_victim", subscription_status: "inactive", stripe_subscription_id: null });
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(recordTrialLedger).not.toHaveBeenCalled();
    expect(sendBusinessEventAlert).toHaveBeenCalledWith(
      "checkout_unlinked",
      expect.objectContaining({ userId: "victim", userIdSource: "client_reference_id", stripeCustomerId: "cus_attacker", rowFound: true })
    );
  });

  it("a row with no Stripe customer yet is not linked from a session", async () => {
    db = fakeDb({ users: [user({ stripe_customer_id: null, subscription_status: "inactive" })] });
    await post(checkoutEvent({ metadata: {}, client_reference_id: "u1" }));
    expect(db.tables.users[0]).toMatchObject({ stripe_customer_id: null, subscription_status: "inactive" });
  });

  it("client_reference_id with the matching customer activates", async () => {
    db = fakeDb({ users: [user({ subscription_status: "inactive", stripe_subscription_id: null })] });
    expect((await post(checkoutEvent({ metadata: {}, client_reference_id: "u1" }))).status).toBe(200);
    expect(db.tables.users[0]).toMatchObject({ subscription_status: "active", stripe_subscription_id: "sub_new" });
  });

  it("never writes stripe_customer_id, even on a matching activation", async () => {
    db = fakeDb({ users: [user({ subscription_status: "inactive", stripe_subscription_id: null })] });
    const updates = [];
    const from = db.from.bind(db);
    db.from = (table) => {
      const q = from(table);
      if (table === "users") {
        const update = q.update;
        q.update = (data) => (updates.push(data), update(data));
      }
      return q;
    };
    await post(checkoutEvent());
    expect(db.tables.users[0].subscription_status).toBe("active");
    expect(updates.length).toBeGreaterThan(0);
    for (const data of updates) expect(data).not.toHaveProperty("stripe_customer_id");
  });

  it("a session with no user id at all activates nothing", async () => {
    db = fakeDb({ users: [user({ subscription_status: "inactive" })] });
    await post(checkoutEvent({ metadata: {}, client_reference_id: null }));
    expect(db.tables.users[0].subscription_status).toBe("inactive");
  });
});
