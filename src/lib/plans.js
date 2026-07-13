/**
 * Plan helpers for Clinchd subscription tiers.
 *
 * Two tiers exist:
 *   - "base"      → $97/mo, 1,500 qualified conversations/month
 *   - "unlimited" → $197/mo, unlimited conversations + comment-to-DM (the "Setter" plan)
 *
 * Use these helpers instead of inline string comparisons against `plan` so
 * pricing/feature gates stay in one place.
 */

// Single source of truth for plan limits and pricing.
// Update here and import everywhere — do not hardcode plan details in components.
export const PLANS = {
  BASE: {
    id: "base",
    name: "Base",
    priceMonthly: 97,
    conversationLimit: 1500,
    unlimited: false,
  },
  UNLIMITED: {
    id: "unlimited",
    name: "Unlimited",
    priceMonthly: 197,
    conversationLimit: null,
    unlimited: true,
  },
};

/**
 * Returns the monthly conversation limit for a given plan.
 * Unlimited returns Infinity so callers can do `count < getDmLimit(plan)`
 * without special-casing the unlimited tier.
 *
 * @param {string} plan
 * @returns {number}
 */
export function getDmLimit(plan) {
  if (plan === "unlimited") return Infinity;
  return PLANS.BASE.conversationLimit;
}

/**
 * Returns true when the plan includes the comment-to-DM feature.
 * Bundled into Unlimited as a competitive moat.
 *
 * @param {string} plan
 * @returns {boolean}
 */
export function hasCommentToDM(plan) {
  return plan === "unlimited";
}

/**
 * Returns display metadata for a plan, used by billing/pricing UI.
 * Falls back to a "Free" descriptor for unknown / pre-trial users so the
 * billing page can render before a subscription exists.
 *
 * @param {string} plan
 * @returns {{ name: string, price: string, period: string }}
 */
export function getPlanDisplay(plan) {
  if (plan === "unlimited") {
    return { name: "Unlimited Plan", price: "$197", period: "/mo" };
  }
  if (plan === "base") {
    return { name: "Base Plan", price: "$97", period: "/mo" };
  }
  return { name: "Free", price: "$0", period: "" };
}
