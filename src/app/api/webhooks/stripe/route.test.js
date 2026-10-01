import { describe, it, expect, vi, beforeEach } from "vitest";

// Route-level tests for the Stripe webhook: the handler runs for real, with
// Stripe, Supabase and the side-effect modules stubbed. The fake client lives
// here rather than in test-utils/fake-supabase.js because it needs reads,
// .or() filters and injected errors that the shared helper does not.

const stripe = {
  webhooks: { constructEvent: (body) => JSON.parse(body) },
  subscriptions: { retrieve: vi.fn() },
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
      };
    },
  };
}

const post = (event) =>
  POST({
    text: async () => JSON.stringify(event),
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

  it.each(["active", "trialing"])("activates for a live %s subscription", async (status) => {
    stripe.subscriptions.retrieve.mockResolvedValue({ id: "sub_new", status });
    db = fakeDb({
      users: [user({ subscription_status: "canceled", stripe_subscription_id: "sub_old", plan: "base", ai_mode: "off", cancel_at: "2026-08-01T00:00:00.000Z" })],
    });
    const res = await post(checkout);
    expect(res.status).toBe(200);
    expect(db.tables.users[0]).toMatchObject({
      subscription_status: "active",
      stripe_subscription_id: "sub_new",
      plan: "unlimited",
      ai_mode: "active",
      cancel_at: null,
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
