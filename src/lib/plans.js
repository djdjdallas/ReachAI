/**
 * Plan catalog for Clinchd subscription tiers. Leaf module, no imports:
 * safe for client components.
 *
 * THE single source of plan prices and copy. The Stripe price ids live
 * server-side only, in src/lib/stripe.js (read from env), which builds its
 * PLANS from this catalog. Never hardcode a plan price in a component.
 *
 * Two tiers:
 *   - "base"      → $97/mo, 1,500 qualified conversations/month
 *   - "unlimited" → $197/mo, unlimited conversations + comment-to-DM
 */

export const PLAN_IDS = ["base", "unlimited"];

export const PLAN_CATALOG = Object.freeze({
  base: Object.freeze({
    id: "base",
    name: "Base",
    displayName: "Base Plan",
    priceCents: 9700,
    conversationLimit: 1500,
    dmLimitLabel: "1,500 qualified conversations/month",
    features: [
      "1,500 AI-assisted qualified conversations per month",
      "AI-assisted lead qualification",
      "Calendar-connected call booking",
      "Script builder with AI generation",
      "Conversation dashboard",
      "Email support",
    ],
    popular: false,
  }),
  unlimited: Object.freeze({
    id: "unlimited",
    name: "Unlimited",
    displayName: "Unlimited Plan",
    priceCents: 19700,
    conversationLimit: null,
    dmLimitLabel: "Unlimited conversations",
    features: [
      "Unlimited AI-assisted conversations",
      "AI-assisted lead qualification",
      "Calendar-connected call booking",
      "Script builder with AI generation",
      "Conversation dashboard",
      "Advanced analytics & reporting",
      "Priority support",
      "Custom AI personality tuning",
      "Comment-to-DM with AI intent grading",
    ],
    popular: true,
  }),
});

/** The catalog entry for a plan id, or null for anything unknown. */
export function getPlan(id) {
  return Object.prototype.hasOwnProperty.call(PLAN_CATALOG, id) ? PLAN_CATALOG[id] : null;
}

/** 9700 → "$97", 9799 → "$97.99" */
export function formatPlanPrice(cents) {
  const dollars = cents / 100;
  return `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
}

// Legacy shape kept for existing callers (getDmLimit below).
export const PLANS = {
  BASE: {
    id: "base",
    name: "Base",
    priceMonthly: PLAN_CATALOG.base.priceCents / 100,
    conversationLimit: PLAN_CATALOG.base.conversationLimit,
    unlimited: false,
  },
  UNLIMITED: {
    id: "unlimited",
    name: "Unlimited",
    priceMonthly: PLAN_CATALOG.unlimited.priceCents / 100,
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
 * Falls back to a "Free" descriptor for unknown / pre-checkout users.
 *
 * @param {string} plan
 * @returns {{ name: string, price: string, period: string }}
 */
export function getPlanDisplay(plan) {
  const p = getPlan(plan);
  if (p) return { name: p.displayName, price: formatPlanPrice(p.priceCents), period: "/mo" };
  return { name: "Free", price: "$0", period: "" };
}

/**
 * Label for a plan's button on /billing. Direction comes from the catalog
 * price, so a cheaper plan is never called an "Upgrade" (sandbox run,
 * 2026-10-05: Base showed "Upgrade" to an Unlimited subscriber).
 *
 * @param {object} args
 * @param {string} args.currentPlanId - users.plan
 * @param {boolean} args.hasLivePlan - a serving Stripe subscription or a
 *   comped plan. Without one (new, canceled, legacy trial) every plan is a
 *   new subscription, whatever users.plan says (new rows default to 'base').
 * @param {string} args.targetPlanId
 */
export function planButtonLabel({ currentPlanId, hasLivePlan, targetPlanId }) {
  if (!hasLivePlan) return "Subscribe";
  const current = PLAN_CATALOG[currentPlanId];
  const target = PLAN_CATALOG[targetPlanId];
  if (!current || !target) return "Switch plan";
  return target.priceCents > current.priceCents ? "Upgrade" : `Switch to ${target.name}`;
}
