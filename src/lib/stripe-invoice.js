// Leaf module, no imports. Reads the subscription ID off a Stripe invoice,
// and holds the invoice.payment_failed write + dunning copy so both are
// testable without the route.
//
// Since API version 2025-03-31 (basil), invoices no longer carry a top-level
// `subscription`. It moved to `parent.subscription_details.subscription`.
// The live webhook endpoint is pinned to 2026-03-25.dahlia, so a check on
// `invoice.subscription` alone is always undefined and the invoice handlers
// silently no-op. Confirmed on in_1UJmulGplBlBR1AHYTlvQjaL (2026-09-26).
// The top-level field is still read as a fallback for older payloads.

/**
 * @param {object} invoice - Stripe invoice object
 * @returns {string|null} the subscription ID, or null for a non-subscription
 *   invoice
 */
export function subscriptionIdFromInvoice(invoice) {
  const fromParent = invoice?.parent?.subscription_details?.subscription;
  const sub = fromParent ?? invoice?.subscription ?? null;
  // Expanded payloads carry the full object instead of the ID.
  if (sub && typeof sub === "object") return sub.id ?? null;
  return sub || null;
}

/**
 * Flip a customer to past_due after a failed subscription invoice. Never
 * touches a canceled row: Stripe delivery is unordered, so the final failed
 * invoice can arrive AFTER customer.subscription.deleted, and past_due is a
 * serving status for the reply gates. Same guard as payment_succeeded.
 *
 * @param {object} supabase - service-role client
 * @param {string} customerId
 * @returns {Promise<{email: string|null, full_name: string|null}|null>} the
 *   updated row (for the dunning email), or null when nothing was flipped
 */
export async function markPastDue(supabase, customerId) {
  const { data, error } = await supabase
    .from("users")
    .update({ subscription_status: "past_due" })
    .eq("stripe_customer_id", customerId)
    .neq("subscription_status", "canceled")
    .select("email, full_name");
  if (error) throw error;
  return data?.[0] ?? null;
}

/** Dunning email body for a failed payment. */
export function dunningEmailHtml({ fullName, billingUrl }) {
  return `<p>Hi${fullName ? ` ${fullName}` : ""},</p>
<p>Your latest Clinchd payment failed. This is usually an expired or declined card. Your AI agent is still replying to leads for now, and Stripe will retry the charge automatically over the next few days.</p>
<p>To avoid any interruption, update your payment method here: <a href="${billingUrl}">${billingUrl}</a></p>
<p>Clinchd</p>`;
}
