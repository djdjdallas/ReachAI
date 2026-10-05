// Leaf module, no imports. Reads a pending cancellation off a Stripe
// subscription for users.cancel_at / users.canceled_at, and writes them
// (syncPendingCancel takes the client as an argument).
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

/**
 * Write the pending-cancel columns and report whether this is a NEW cancel
 * request. Conditional updates instead of read-then-write: the
 * "cancel_at is null" filter and the write are one UPDATE, so of two
 * concurrent deliveries of the same event exactly one sees the row
 * unclaimed and gets newRequest: true (one founder alert, not two).
 *
 * Pass the cancel state read from the LIVE subscription, not the event
 * payload: a cancel event delivered after the customer reactivated then
 * finds cancel_at null on Stripe and sets nothing.
 *
 * @param {object} supabase - service-role client
 * @param {string} customerId
 * @param {{cancelAt: string|null, canceledAt: string|null}} pending - from
 *   pendingCancelFromSubscription(liveSubscription)
 * @returns {Promise<{newRequest: boolean, row: object|null}>} row carries
 *   the alert fields when newRequest
 */
export async function syncPendingCancel(supabase, customerId, { cancelAt, canceledAt }) {
  const users = () => supabase.from("users");

  if (!cancelAt) {
    // No cancel pending (never was, or reactivated): clear any leftover.
    const { error } = await users()
      .update({ cancel_at: null, canceled_at: null })
      .eq("stripe_customer_id", customerId)
      .not("cancel_at", "is", null);
    if (error) throw error;
    return { newRequest: false, row: null };
  }

  // Claim: only a row with no pending cancel takes the write.
  const { data: claimed, error: claimError } = await users()
    .update({ cancel_at: cancelAt, canceled_at: canceledAt })
    .eq("stripe_customer_id", customerId)
    .is("cancel_at", null)
    .select("id, email, instagram_username, plan");
  if (claimError) throw claimError;
  if (claimed?.length) return { newRequest: true, row: claimed[0] };

  // Already pending: keep the dates current (e.g. the end date moved), with
  // no alert.
  const { error } = await users()
    .update({ cancel_at: cancelAt, canceled_at: canceledAt })
    .eq("stripe_customer_id", customerId)
    .not("cancel_at", "is", null);
  if (error) throw error;
  return { newRequest: false, row: null };
}
