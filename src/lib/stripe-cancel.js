// Leaf module, no imports. Reads a pending cancellation off a Stripe
// subscription for users.cancel_at / users.canceled_at.
//
// Two shapes mean "pending":
//   - cancel_at set (what the Stripe portal sends now: cancel_at = period
//     end, cancel_at_period_end: false; seen on sub_1UJmunGplBlBR1AHNa5X84zi)
//   - cancel_at_period_end: true (older shape), ending at the period end,
//     which since API 2025-03-31 lives on the subscription item
// Anything else (including a reactivation) returns nulls, which clears both
// columns.

const toIso = (unix) =>
  typeof unix === "number" ? new Date(unix * 1000).toISOString() : null;

/**
 * @param {object} subscription - Stripe subscription object
 * @returns {{cancelAt: string|null, canceledAt: string|null}} ISO strings
 */
export function pendingCancelFromSubscription(subscription) {
  const periodEnd =
    subscription?.items?.data?.[0]?.current_period_end ??
    subscription?.current_period_end ??
    null;
  const cancelAt =
    subscription?.cancel_at ??
    (subscription?.cancel_at_period_end ? periodEnd : null);
  if (typeof cancelAt !== "number") {
    return { cancelAt: null, canceledAt: null };
  }
  return {
    cancelAt: toIso(cancelAt),
    canceledAt: toIso(subscription?.canceled_at ?? null),
  };
}
