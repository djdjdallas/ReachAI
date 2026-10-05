import { describe, it, expect } from "vitest";
import { pendingCancelFromSubscription, syncPendingCancel } from "./stripe-cancel";
import { CLEAR_PENDING_CANCEL } from "./stripe-subscription-guard";
import { fakeSupabase } from "./test-utils/fake-supabase";

describe("pendingCancelFromSubscription", () => {
  it("reads the portal shape (cancel_at set, cancel_at_period_end false)", () => {
    // sub_1UJmunGplBlBR1AHNa5X84zi as read on 2026-09-28.
    expect(
      pendingCancelFromSubscription({
        status: "active",
        cancel_at: 1792987723,
        cancel_at_period_end: false,
        canceled_at: 1790437657,
      })
    ).toEqual({
      cancelAt: "2026-10-26T04:08:43.000Z",
      canceledAt: "2026-09-26T15:47:37.000Z",
    });
  });

  it("reads cancel_at_period_end with the period end on the item", () => {
    expect(
      pendingCancelFromSubscription({
        cancel_at: null,
        cancel_at_period_end: true,
        canceled_at: 1790437657,
        items: { data: [{ current_period_end: 1792987723 }] },
      }).cancelAt
    ).toBe("2026-10-26T04:08:43.000Z");
  });

  it("falls back to the legacy top-level current_period_end", () => {
    expect(
      pendingCancelFromSubscription({ cancel_at_period_end: true, current_period_end: 1792987723 }).cancelAt
    ).toBe("2026-10-26T04:08:43.000Z");
  });

  it("clears both on reactivation", () => {
    expect(
      pendingCancelFromSubscription({ cancel_at: null, cancel_at_period_end: false, canceled_at: null })
    ).toEqual({ cancelAt: null, canceledAt: null });
  });

  it("clears canceled_at too when Stripe leaves it set after reactivation", () => {
    expect(
      pendingCancelFromSubscription({ cancel_at: null, cancel_at_period_end: false, canceled_at: 1790437657 })
    ).toEqual({ cancelAt: null, canceledAt: null });
  });

  it("handles a missing subscription", () => {
    expect(pendingCancelFromSubscription(null)).toEqual({ cancelAt: null, canceledAt: null });
  });
});

describe("syncPendingCancel (M3)", () => {
  const PENDING = {
    cancelAt: "2026-10-26T04:08:43.000Z",
    canceledAt: "2026-09-26T15:47:37.000Z",
  };
  const NONE = { cancelAt: null, canceledAt: null };
  const row = (extra = {}) => ({
    id: "user-1",
    stripe_customer_id: "cus_1",
    email: "coach@example.com",
    instagram_username: "coachig",
    plan: "unlimited",
    cancel_at: null,
    canceled_at: null,
    ...extra,
  });

  it("first delivery is a new request and returns the alert fields", async () => {
    const db = fakeSupabase({ users: [row()] });
    const r = await syncPendingCancel(db, "cus_1", PENDING);
    expect(r).toEqual({
      newRequest: true,
      row: { id: "user-1", email: "coach@example.com", instagram_username: "coachig", plan: "unlimited" },
    });
    expect(db.tables.users[0].cancel_at).toBe(PENDING.cancelAt);
  });

  it("a redelivery of the same event alerts once, not twice", async () => {
    const db = fakeSupabase({ users: [row()] });
    const first = await syncPendingCancel(db, "cus_1", PENDING);
    const second = await syncPendingCancel(db, "cus_1", PENDING);
    expect([first.newRequest, second.newRequest]).toEqual([true, false]);
  });

  it("two concurrent deliveries alert once (the read-then-write version sent two)", async () => {
    const db = fakeSupabase({ users: [row()] });
    const results = await Promise.all([
      syncPendingCancel(db, "cus_1", PENDING),
      syncPendingCancel(db, "cus_1", PENDING),
    ]);
    expect(results.filter((r) => r.newRequest)).toHaveLength(1);
  });

  it("keeps the dates current on a repeat without alerting", async () => {
    const db = fakeSupabase({ users: [row({ cancel_at: "2026-10-01T00:00:00.000Z" })] });
    const r = await syncPendingCancel(db, "cus_1", PENDING);
    expect(r.newRequest).toBe(false);
    expect(db.tables.users[0].cancel_at).toBe(PENDING.cancelAt);
  });

  it("a reactivation clears both columns", async () => {
    const db = fakeSupabase({ users: [row({ cancel_at: PENDING.cancelAt, canceled_at: PENDING.canceledAt })] });
    expect(await syncPendingCancel(db, "cus_1", NONE)).toEqual({ newRequest: false, row: null });
    expect(db.tables.users[0]).toMatchObject({ cancel_at: null, canceled_at: null });
  });

  it("a cancel event delivered after the reactivation sets nothing (state read from live Stripe)", async () => {
    const db = fakeSupabase({ users: [row()] });
    // Stale event payload says cancel_at is set; the live subscription, which
    // is what the handler passes, says it was reactivated.
    const liveAfterReactivation = { status: "active", cancel_at: null, cancel_at_period_end: false, canceled_at: 1790437657 };
    const r = await syncPendingCancel(db, "cus_1", pendingCancelFromSubscription(liveAfterReactivation));
    expect(r.newRequest).toBe(false);
    expect(db.tables.users[0].cancel_at).toBeNull();
  });

  it("after a resubscribe clears the old cancel (M2), the next cancel request alerts again", async () => {
    const users = [row({ cancel_at: "2026-08-01T00:00:00.000Z", canceled_at: "2026-07-05T00:00:00.000Z" })];
    // checkout.session.completed / subscription.deleted write CLEAR_PENDING_CANCEL.
    Object.assign(users[0], CLEAR_PENDING_CANCEL);
    const db = fakeSupabase({ users });
    expect((await syncPendingCancel(db, "cus_1", PENDING)).newRequest).toBe(true);
  });
});
