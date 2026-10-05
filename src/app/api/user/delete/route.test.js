import { describe, it, expect, vi, beforeEach } from "vitest";

// Order of side effects in DELETE /api/user/delete: the founder alert and
// the PostHog event must happen BEFORE anything is deleted, and a failure
// in either must not stop the deletion.

const order = [];
const profile = {
  stripe_subscription_id: null,
  meta_page_access_token: null,
  instagram_business_account_id: null,
  email: "coach@example.com",
  instagram_username: "coachig",
  plan: "base",
  subscription_status: "trialing",
  created_at: new Date(Date.now() - 5 * 3_600_000).toISOString(),
};

function admin() {
  return {
    from(table) {
      const q = { table, op: "select" };
      const b = new Proxy(
        {},
        {
          get(_, prop) {
            if (prop === "then") {
              return (resolve) => {
                if (q.op === "delete") order.push(`delete:${table}`);
                if (table === "users" && q.op === "select") return resolve({ data: profile, error: null });
                return resolve({ data: q.op === "select" ? [] : null, error: null });
              };
            }
            if (prop === "delete") return () => ((q.op = "delete"), b);
            return () => b;
          },
        }
      );
      return b;
    },
    auth: {
      admin: {
        deleteUser: vi.fn(async () => {
          order.push("delete:auth");
          return { error: null };
        }),
      },
    },
  };
}

const alert = vi.fn(async () => {
  order.push("alert");
  return true;
});
const capture = vi.fn(async () => {
  order.push("posthog");
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user-1", email: "coach@example.com" } } }) },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => admin() }));
vi.mock("@/lib/stripe", () => ({ getStripe: () => ({ subscriptions: { cancel: vi.fn() } }) }));
vi.mock("@/lib/token-utils", () => ({ decryptToken: vi.fn() }));
vi.mock("@/lib/posthog-server", () => ({
  getPostHogClient: () => ({ captureImmediate: capture }),
}));
vi.mock("@/lib/alerts/business-events", async (importOriginal) => ({
  ...(await importOriginal()),
  sendBusinessEventAlert: alert,
}));

const { DELETE } = await import("./route");

beforeEach(() => {
  order.length = 0;
  alert.mockClear();
  capture.mockClear();
});

describe("DELETE /api/user/delete", () => {
  it("alerts and captures before anything is deleted", async () => {
    const res = await DELETE();
    expect(res.status).toBe(200);
    expect(order.slice(0, 2)).toEqual(["alert", "posthog"]);
    expect(order).toContain("delete:users");
    expect(order.at(-1)).toBe("delete:auth");

    const [event, payload] = alert.mock.calls[0];
    expect(event).toBe("account_deleted");
    expect(payload).toMatchObject({
      email: "coach@example.com",
      instagramUsername: "coachig",
      plan: "base",
      subscriptionStatus: "trialing",
      createdAt: profile.created_at,
      accountAgeHours: 5,
    });
    expect(capture.mock.calls[0][0]).toMatchObject({
      distinctId: "user-1",
      event: "account_deleted",
    });
  });

  it("still deletes when PostHog fails", async () => {
    capture.mockRejectedValueOnce(new Error("posthog down"));
    const res = await DELETE();
    expect(res.status).toBe(200);
    expect(order).toContain("delete:auth");
  });
});
