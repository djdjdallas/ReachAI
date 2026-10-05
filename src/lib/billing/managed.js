// Accounts whose plan is set by Clinchd, not bought through Stripe:
// comped founders and friends today, managed (invoiced) accounts later.
// They see "Complimentary plan" and never a Subscribe / Upgrade / Switch
// button or the Stripe portal: there is nothing for them to buy, and a
// click would start a paid Checkout. Keyed on the server's access kind
// (GET /api/billing/access, src/lib/billing/access.js), never on columns
// the browser reads directly.
//
// Adding a managed kind later (e.g. 'managed') is one entry here.
export const MANAGED_ACCESS_KINDS = new Set(["comped"]);

/** @param {{kind?: string}|null} access - /api/billing/access response */
export function isManagedAccount(access) {
  return !!access && MANAGED_ACCESS_KINDS.has(access.kind);
}

/**
 * What /billing shows. Pure; the page renders it.
 *
 * @param {object} args
 * @param {{kind?: string, hasAccess?: boolean}|null} args.access
 * @param {boolean} args.hasStripeCustomer - profile.stripe_customer_id set
 * @returns {{managed: boolean, showPrice: boolean, showPortal: boolean, showPlanButtons: boolean}}
 */
export function billingPageView({ access, hasStripeCustomer }) {
  const managed = isManagedAccount(access);
  return {
    managed,
    showPrice: !managed,
    showPortal: !managed && hasStripeCustomer,
    showPlanButtons: !managed,
  };
}
