// Leaf module, no imports. Reads the subscription ID off a Stripe invoice.
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
