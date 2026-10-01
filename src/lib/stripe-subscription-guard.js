// Leaf module, no imports. Decides whether a Stripe subscription webhook may
// write to a users row.
//
// Stripe delivery is at-least-once and unordered: a retried
// customer.subscription.updated (or a replayed checkout.session.completed)
// can land AFTER customer.subscription.deleted, and both handlers used to
// write subscription_status 'active' and restore ai_mode unconditionally,
// resurrecting a canceled customer for free. The handlers now re-read the
// subscription from Stripe and decide on its LIVE status, never the event
// payload, which is exactly what is stale in a late delivery.

// Stripe subscription status → users.subscription_status
export function mapSubscriptionStatus(stripeStatus) {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
      return "canceled";
    default:
      return stripeStatus;
  }
}

/**
 * customer.subscription.updated.
 *
 * @param {object} args
 * @param {object|null} args.row - users row (subscription_status,
 *   stripe_subscription_id)
 * @param {string} args.subscriptionId - the event's subscription id
 * @param {string} args.liveStatus - that subscription's status, read from
 *   Stripe now
 * @returns {{apply: boolean, reason: string}}
 */
export function decideSubscriptionUpdate({ row, subscriptionId, liveStatus }) {
  if (!row) return { apply: false, reason: "no_row" };

  // An event for a subscription this row no longer tracks (e.g. the old one,
  // after the customer resubscribed) must not overwrite the current one.
  if (row.stripe_subscription_id && row.stripe_subscription_id !== subscriptionId) {
    return { apply: false, reason: "other_subscription" };
  }

  if (row.subscription_status === "canceled") {
    // Already canceled and Stripe agrees: customer.subscription.deleted owns
    // that state (plan reset, AI off). Re-writing here put plan back to the
    // canceled tier.
    if (mapSubscriptionStatus(liveStatus) === "canceled") {
      return { apply: false, reason: "already_canceled" };
    }
    // Canceled row, live subscription serving again. Only trust that for the
    // subscription this row tracks (an unpaid sub the customer paid off).
    if (row.stripe_subscription_id !== subscriptionId) {
      return { apply: false, reason: "canceled_row_unverified" };
    }
  }

  return { apply: true, reason: "ok" };
}

/**
 * checkout.session.completed. A new checkout legitimately activates a
 * canceled row (that is a resubscribe), so there is no row guard here: the
 * question is only whether the subscription it created is serving right
 * now. Allowlist, not blocklist: a replay after the subscription ended, went
 * unpaid, paused or past_due must not write 'active'.
 *
 * @param {string|null} liveStatus - status of session.subscription, read
 *   from Stripe now (null for a session with no subscription)
 */
export function shouldActivateCheckout(liveStatus) {
  return liveStatus === "active" || liveStatus === "trialing";
}

/**
 * customer.subscription.deleted. PostgREST .or() filter for the cancel
 * UPDATE: only a row tracking this subscription (or none yet) matches, so a
 * late delete of the OLD subscription can't cancel a customer who has since
 * resubscribed. In the UPDATE itself, not a prior read, so it holds even
 * when it races the checkout that writes the new subscription id.
 *
 * @param {string} subscriptionId - Stripe ids are [A-Za-z0-9_], safe here
 */
export function deletionMatchFilter(subscriptionId) {
  return `stripe_subscription_id.is.null,stripe_subscription_id.eq.${subscriptionId}`;
}

// Written on checkout.session.completed and customer.subscription.deleted.
// A pending cancel ends either way; leaving it set on a resubscribe showed
// "Your plan ends <past date>", kept the drip off, and suppressed the alert
// for the customer's next cancel request.
export const CLEAR_PENDING_CANCEL = Object.freeze({
  cancel_at: null,
  canceled_at: null,
});
