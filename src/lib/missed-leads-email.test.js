import { describe, it, expect, vi } from "vitest";
import {
  accountBlocker,
  digestDue,
  buildMissedLeadsEmail,
  runMissedLeadsDigest,
  BLOCKERS,
  DIGEST_EVENT_TYPE,
  HELD_REASONS,
} from "./missed-leads-email";

const NOW = Date.parse("2026-10-29T16:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const ago = (days) => new Date(NOW - days * DAY).toISOString();

const coach = (o) => ({
  id: "u1",
  email: "coach@example.com",
  full_name: "Sam Rivera",
  ai_mode: "active",
  script_config: { greeting: "Hey! What made you reach out?" },
  onboarding_completed: true,
  plan: "base",
  subscription_status: "active",
  stripe_subscription_id: "sub_1",
  trial_ends_at: null,
  current_period_end: "2026-11-20T00:00:00Z",
  billing_managed: false,
  ...o,
});

describe("accountBlocker", () => {
  it("is null for a fully set up account with access", () => {
    expect(accountBlocker(coach(), NOW)).toBeNull();
  });

  it("names an ended legacy trial before anything else", () => {
    const u = coach({ subscription_status: "trialing", stripe_subscription_id: null, trial_ends_at: ago(20), script_config: {} });
    expect(accountBlocker(u, NOW)).toBe(BLOCKERS.TRIAL_EXPIRED);
  });

  it("names a canceled plan", () => {
    expect(accountBlocker(coach({ subscription_status: "canceled" }), NOW)).toBe(BLOCKERS.SUBSCRIPTION_INACTIVE);
  });

  it("flags unfinished setup (the handoff default) as setup_incomplete", () => {
    expect(accountBlocker(coach({ onboarding_completed: false, ai_mode: "handoff" }), NOW)).toBe(BLOCKERS.SETUP_INCOMPLETE);
    expect(accountBlocker(coach({ onboarding_completed: false, script_config: {} }), NOW)).toBe(BLOCKERS.SETUP_INCOMPLETE);
  });

  it("flags a legacy active account with no opening line", () => {
    expect(accountBlocker(coach({ script_config: { greeting: "  " } }), NOW)).toBe(BLOCKERS.NO_OPENING_LINE);
  });

  it("leaves a coach who finished setup and chose handoff alone", () => {
    expect(accountBlocker(coach({ ai_mode: "handoff" }), NOW)).toBeNull();
    expect(accountBlocker(coach({ ai_mode: "handoff", script_config: {} }), NOW)).toBeNull();
  });

  it("never emails a managed account", () => {
    expect(accountBlocker(coach({ billing_managed: true, onboarding_completed: false }), NOW)).toBeNull();
  });
});

describe("digestDue", () => {
  it("sends the first one", () => {
    expect(digestDue([], NOW)).toBe(true);
  });

  it("waits a week between sends", () => {
    expect(digestDue([ago(3)], NOW)).toBe(false);
    expect(digestDue([ago(7)], NOW)).toBe(true);
  });

  it("stops after 4 in 90 days", () => {
    expect(digestDue([ago(7), ago(14), ago(21), ago(28)], NOW)).toBe(false);
    expect(digestDue([ago(14), ago(21), ago(28), ago(95)], NOW)).toBe(true);
  });
});

describe("buildMissedLeadsEmail", () => {
  it("leads with the real count and the reason, with a link to the fix", () => {
    const e = buildMissedLeadsEmail({ user: coach(), count: 7, blocker: BLOCKERS.TRIAL_EXPIRED, appUrl: "https://app.test" });
    expect(e.subject).toBe("7 people messaged you this week. Clinchd didn't reply.");
    expect(e.html).toContain("Hi Sam,");
    expect(e.html).toContain("Your free trial ended");
    expect(e.html).toContain("https://app.test/choose-plan");
  });

  it("uses the singular for one lead", () => {
    const e = buildMissedLeadsEmail({ user: coach(), count: 1, blocker: BLOCKERS.SETUP_INCOMPLETE, appUrl: "https://app.test" });
    expect(e.subject).toBe("1 person messaged you this week. Clinchd didn't reply.");
    expect(e.html).toContain("didn&#39;t reply to them.");
    expect(e.html).toContain("https://app.test/onboarding");
  });

  it("has no em dashes in any variant", () => {
    for (const blocker of Object.values(BLOCKERS)) {
      const e = buildMissedLeadsEmail({ user: coach(), count: 3, blocker, appUrl: "https://app.test" });
      expect(e.subject + e.html).not.toMatch(/—/);
    }
  });

  it("escapes the coach's name and falls back when it's missing", () => {
    expect(buildMissedLeadsEmail({ user: coach({ full_name: "<b>x</b>" }), count: 2, blocker: BLOCKERS.NO_OPENING_LINE, appUrl: "" }).html).toContain("Hi &lt;b&gt;x&lt;/b&gt;,");
    expect(buildMissedLeadsEmail({ user: coach({ full_name: null }), count: 2, blocker: BLOCKERS.NO_OPENING_LINE, appUrl: "" }).html).toContain("Hi there,");
  });

  it("sends nothing for a zero count", () => {
    expect(buildMissedLeadsEmail({ user: coach(), count: 0, blocker: BLOCKERS.TRIAL_EXPIRED, appUrl: "" })).toBeNull();
  });
});

// Minimal chainable stand-in for the service-role client: every builder
// method returns the chain, and awaiting it resolves the table's result.
function fakeAdmin({ users, pastSends = {}, counts = {} }) {
  const inserts = [];
  const calls = [];
  const admin = {
    inserts,
    calls,
    from(table) {
      const filters = {};
      const chain = {
        select: () => chain,
        not: () => chain,
        eq: (col, val) => ((filters[col] = val), chain),
        in: (col, val) => ((filters[col] = val), chain),
        gte: (col, val) => ((filters[`${col}>=`] = val), chain),
        insert: (row) => (inserts.push(row), Promise.resolve({ error: null })),
        then: (resolve) => {
          calls.push({ table, filters });
          if (table === "users") return resolve({ data: users, error: null });
          if (table === "email_events") return resolve({ data: pastSends[filters.user_id] || [], error: null });
          return resolve({ count: counts[filters.user_id] ?? 0, error: null });
        },
      };
      return chain;
    },
  };
  return admin;
}

describe("runMissedLeadsDigest", () => {
  it("emails a blocked account with recent held leads and logs the send", async () => {
    const admin = fakeAdmin({
      users: [coach({ id: "lapsed", subscription_status: "trialing", stripe_subscription_id: null, trial_ends_at: ago(20) })],
      counts: { lapsed: 7 },
    });
    const send = vi.fn().mockResolvedValue({ success: true, messageId: "m1" });

    const stats = await runMissedLeadsDigest(admin, { send, appUrl: "https://app.test", now: NOW });

    expect(stats).toEqual({ candidates: 1, sent: 1, skipped: 0, errors: 0 });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: "coach@example.com", subject: "7 people messaged you this week. Clinchd didn't reply." }));
    expect(admin.inserts).toEqual([
      { user_id: "lapsed", event_type: DIGEST_EVENT_TYPE, metadata: { count: 7, blocker: "trial_expired", messageId: "m1" }, sent_at: new Date(NOW).toISOString() },
    ]);
    const countCall = admin.calls.find((c) => c.table === "conversations");
    expect(countCall.filters.last_skip_reason).toEqual(HELD_REASONS);
    expect(countCall.filters["last_message_at>="]).toBe(ago(7));
  });

  it("skips healthy accounts, throttled accounts and zero counts", async () => {
    const admin = fakeAdmin({
      users: [
        coach({ id: "ok" }),
        coach({ id: "recent", onboarding_completed: false, ai_mode: "handoff" }),
        coach({ id: "quiet", onboarding_completed: false, ai_mode: "handoff" }),
      ],
      pastSends: { recent: [{ sent_at: ago(2) }] },
      counts: { recent: 5, quiet: 0 },
    });
    const send = vi.fn();

    const stats = await runMissedLeadsDigest(admin, { send, appUrl: "", now: NOW });

    expect(stats).toEqual({ candidates: 2, sent: 0, skipped: 2, errors: 0 });
    expect(send).not.toHaveBeenCalled();
    expect(admin.inserts).toEqual([]);
  });

  it("doesn't log a send that failed, so tomorrow's run retries", async () => {
    const admin = fakeAdmin({ users: [coach({ id: "x", subscription_status: "canceled" })], counts: { x: 2 } });
    const send = vi.fn().mockResolvedValue({ success: false });

    const stats = await runMissedLeadsDigest(admin, { send, appUrl: "", now: NOW });

    expect(stats.errors).toBe(1);
    expect(admin.inserts).toEqual([]);
  });
});
