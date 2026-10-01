import { describe, it, expect } from "vitest";
import { pendingCancelFromSubscription } from "./stripe-cancel";

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
