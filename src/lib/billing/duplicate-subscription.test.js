import { describe, it, expect, vi } from "vitest";
import { olderLiveSubscription, refundSubscriptionCharges, cancelDuplicateSubscription } from "./duplicate-subscription";

const sub = (id, status, created) => ({ id, status, created });

describe("olderLiveSubscription (audit M3)", () => {
  const current = sub("sub_b", "active", 200);

  it("finds an older live subscription", () => {
    expect(olderLiveSubscription([current, sub("sub_a", "trialing", 100)], current)?.id).toBe("sub_a");
    expect(olderLiveSubscription([current, sub("sub_a", "past_due", 100)], current)?.id).toBe("sub_a");
  });

  it("ignores ended ones, newer ones, and itself", () => {
    expect(
      olderLiveSubscription(
        [current, sub("sub_a", "canceled", 100), sub("sub_x", "incomplete_expired", 50), sub("sub_c", "active", 300)],
        current
      )
    ).toBeNull();
  });

  it("the newer one finds the older; the older finds nothing (exactly one side cancels)", () => {
    const a = sub("sub_a", "active", 100);
    expect(olderLiveSubscription([a, current], current)?.id).toBe("sub_a");
    expect(olderLiveSubscription([a, current], a)).toBeNull();
  });

  it("same-second ties break on id, so still exactly one side cancels", () => {
    const a = sub("sub_a", "active", 200);
    expect(olderLiveSubscription([a, current], current)?.id).toBe("sub_a");
    expect(olderLiveSubscription([a, current], a)).toBeNull();
  });

  it("picks the oldest when there are several", () => {
    expect(
      olderLiveSubscription([current, sub("sub_m", "active", 150), sub("sub_o", "active", 120)], current)?.id
    ).toBe("sub_o");
  });
});

function fakeStripe({ invoices = [], payments = {}, refund } = {}) {
  return {
    invoices: { list: vi.fn(async () => ({ data: invoices })) },
    invoicePayments: { list: vi.fn(async ({ invoice }) => ({ data: payments[invoice] || [] })) },
    refunds: { create: refund || vi.fn(async (args) => ({ id: `re_${args.payment_intent || args.charge}`, amount: 9700, currency: "usd" })) },
    subscriptions: { cancel: vi.fn(async () => ({ status: "canceled" })) },
  };
}

describe("refundSubscriptionCharges", () => {
  it("refunds each paid payment by payment intent, with an idempotency key", async () => {
    const s = fakeStripe({
      invoices: [{ id: "in_1", amount_paid: 9700 }, { id: "in_0", amount_paid: 0 }],
      payments: { in_1: [{ payment: { payment_intent: { id: "pi_1" } } }] },
    });
    const out = await refundSubscriptionCharges(s, "sub_dup");
    expect(s.invoices.list).toHaveBeenCalledWith({ subscription: "sub_dup", status: "paid", limit: 10 });
    expect(s.invoicePayments.list).toHaveBeenCalledTimes(1); // $0 invoice skipped
    expect(s.refunds.create).toHaveBeenCalledWith(
      { payment_intent: "pi_1", reason: "duplicate", metadata: { duplicate_subscription: "sub_dup", invoice: "in_1" } },
      { idempotencyKey: "dup-sub-refund-pi_1" }
    );
    expect(out).toEqual([{ id: "re_pi_1", amount: 9700, currency: "usd" }]);
  });

  it("falls back to the charge", async () => {
    const s = fakeStripe({ invoices: [{ id: "in_1", amount_paid: 9700 }], payments: { in_1: [{ payment: { charge: "ch_1" } }] } });
    await refundSubscriptionCharges(s, "sub_dup");
    expect(s.refunds.create.mock.calls[0][0]).toMatchObject({ charge: "ch_1" });
  });

  it("an already-refunded charge is skipped; other errors throw", async () => {
    const already = Object.assign(new Error("already"), { code: "charge_already_refunded" });
    const s = fakeStripe({
      invoices: [{ id: "in_1", amount_paid: 9700 }],
      payments: { in_1: [{ payment: { payment_intent: "pi_1" } }] },
      refund: vi.fn().mockRejectedValueOnce(already),
    });
    await expect(refundSubscriptionCharges(s, "sub_dup")).resolves.toEqual([]);
    s.refunds.create = vi.fn().mockRejectedValue(new Error("api down"));
    await expect(refundSubscriptionCharges(s, "sub_dup")).rejects.toThrow("api down");
  });

  it("a paid invoice with no refundable payment throws rather than silently keeping the money", async () => {
    const s = fakeStripe({ invoices: [{ id: "in_1", amount_paid: 9700 }], payments: { in_1: [{ payment: {} }] } });
    await expect(refundSubscriptionCharges(s, "sub_dup")).rejects.toThrow(/no refundable payment/);
  });
});

describe("cancelDuplicateSubscription", () => {
  it("cancels immediately with no proration or final invoice, idempotently", async () => {
    const s = fakeStripe();
    await cancelDuplicateSubscription(s, "sub_dup");
    expect(s.subscriptions.cancel).toHaveBeenCalledWith(
      "sub_dup",
      { prorate: false, invoice_now: false },
      { idempotencyKey: "dup-sub-cancel-sub_dup" }
    );
  });
});
