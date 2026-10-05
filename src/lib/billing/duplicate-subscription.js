// Audit M3: one customer, two live subscriptions.
//
// How it happens: the coach opens Checkout in two tabs (or comes back to an
// old Checkout link) and completes both. create-checkout refuses a second
// session once a live subscription exists, but two sessions created before
// either completes both stay payable until they expire (now 30 minutes,
// src/lib/stripe.js). Without this, the coach pays twice and the row tracks
// whichever webhook landed last.
//
// Rule: the OLDER live subscription is the real one. When
// checkout.session.completed arrives for a subscription and the same
// customer already has an older live one, the session's (newer)
// subscription is refunded and canceled immediately, and the founder gets
// an alert. Each checkout event only ever cancels its OWN subscription, so
// two deliveries can't each cancel the other's.
//
// Stripe calls carry idempotency keys and the refund runs before the cancel,
// so a retry after a partial failure (refund done, cancel failed) repeats
// safely: the subscription is still live, the refund returns the same
// object, the cancel goes through.

// Statuses that bill or will bill. 'unpaid'/'canceled'/'incomplete*' don't
// count as a second live subscription.
export const LIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "past_due"]);

const olderThan = (a, b) =>
  a.created < b.created || (a.created === b.created && String(a.id) < String(b.id));

/**
 * The oldest OTHER live subscription that predates `current`, or null.
 * Pure.
 *
 * @param {Array<{id: string, status: string, created: number}>} subscriptions
 *   the customer's subscriptions (stripe.subscriptions.list, status 'all')
 * @param {{id: string, created: number}} current - the session's subscription
 */
export function olderLiveSubscription(subscriptions, current) {
  return (
    (subscriptions || [])
      .filter((s) => s.id !== current.id && LIVE_SUBSCRIPTION_STATUSES.has(s.status) && olderThan(s, current))
      .sort((a, b) => (olderThan(a, b) ? -1 : 1))[0] || null
  );
}

/**
 * Refund every paid charge on a subscription's invoices (a card-required
 * trial's $0 invoice has none). Returns what was refunded.
 * Throws on any Stripe failure so the webhook 500s and Stripe retries.
 */
export async function refundSubscriptionCharges(stripe, subscriptionId) {
  const refunds = [];
  const invoices = await stripe.invoices.list({ subscription: subscriptionId, status: "paid", limit: 10 });
  for (const invoice of invoices.data || []) {
    if (!(invoice.amount_paid > 0)) continue;
    // Since API 2025-03-31 an invoice's payments live on InvoicePayment, not
    // invoice.charge / invoice.payment_intent.
    const payments = await stripe.invoicePayments.list({ invoice: invoice.id, status: "paid", limit: 10 });
    for (const payment of payments.data || []) {
      const pi = payment.payment?.payment_intent;
      const charge = payment.payment?.charge;
      const target = pi
        ? { payment_intent: typeof pi === "string" ? pi : pi.id }
        : charge
          ? { charge: typeof charge === "string" ? charge : charge.id }
          : null;
      if (!target) {
        throw new Error(`paid invoice ${invoice.id} has no refundable payment`);
      }
      const ref = target.payment_intent || target.charge;
      try {
        const refund = await stripe.refunds.create(
          {
            ...target,
            reason: "duplicate",
            metadata: { duplicate_subscription: subscriptionId, invoice: invoice.id },
          },
          { idempotencyKey: `dup-sub-refund-${ref}` }
        );
        refunds.push({ id: refund.id, amount: refund.amount, currency: refund.currency });
      } catch (err) {
        // Refunded on an earlier attempt more than 24h ago (past the
        // idempotency key's life): nothing left to refund.
        if (err?.code === "charge_already_refunded") continue;
        throw err;
      }
    }
  }
  return refunds;
}

/** Cancel now, no proration credit, no final invoice. */
export function cancelDuplicateSubscription(stripe, subscriptionId) {
  return stripe.subscriptions.cancel(
    subscriptionId,
    { prorate: false, invoice_now: false },
    { idempotencyKey: `dup-sub-cancel-${subscriptionId}` }
  );
}
