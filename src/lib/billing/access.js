// THE access decision. Server-side use only: every gate that decides
// whether a user gets the product (middleware, AI send paths, feature
// APIs) calls hasActiveAccess / accessDecision with a users row that
// includes ACCESS_COLUMNS (src/lib/billing/status.js). Browser components
// never decide access; they ask GET /api/billing/access.
//
// Never reads onboarding_completed or any other browser-writable column.
// Every column read here is written only by the server (Stripe webhook,
// signup trigger) and denied to browser writes by the users UPDATE
// allowlist (migration 20261005150000) and protect_billing_columns.
//
// There is no founder/email bypass: founder accounts are comped rows.
//
// Kept free of server-only imports so it's unit-testable and usable in
// middleware; "server-side use only" is a rule for callers, not a module
// restriction.

import { SUBSCRIPTION_STATUS as S } from "./status";

// Renewal lands via webhook a little after current_period_end. Without a
// grace, every paying user would lose access for the minutes between the
// period ending and Stripe's renewal event arriving.
export const PERIOD_END_GRACE_MS = 24 * 60 * 60 * 1000;

// past_due means Stripe is still retrying the card (Smart Retries). When
// retries are exhausted Stripe moves the subscription to unpaid or
// canceled, which denies access. This cap only matters if that final
// event never arrives.
export const PAST_DUE_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

const ms = (v) => {
  if (v == null) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
};

/**
 * @param {object|null} user - users row with ACCESS_COLUMNS
 * @param {number} [now] - ms since epoch, for tests
 * @returns {{hasAccess: boolean, kind: string, reason: string}}
 *   kind: 'stripe' | 'comped' | 'legacy_trial' | 'none'
 */
export function accessDecision(user, now = Date.now()) {
  if (!user) return { hasAccess: false, kind: "none", reason: "no_user" };
  if (user.subscription_status === undefined) {
    // A caller forgot ACCESS_COLUMNS. Fail closed and make it loud.
    console.error("[billing/access] row is missing subscription_status; select ACCESS_COLUMNS");
    return { hasAccess: false, kind: "none", reason: "missing_fields" };
  }

  const status = user.subscription_status;
  const periodEnd = ms(user.current_period_end);
  const trialEnd = ms(user.trial_ends_at);

  // ── Stripe-backed: Stripe owns the clock ────────────────────────────
  if (user.stripe_subscription_id) {
    if (status === S.ACTIVE || status === S.TRIALING) {
      // current_period_end is null for rows synced before the column
      // existed; the status alone (written by Stripe's webhooks) decides
      // then. Stripe moves status off active/trialing when a period ends
      // unpaid or canceled.
      if (periodEnd !== null && now > periodEnd + PERIOD_END_GRACE_MS) {
        return { hasAccess: false, kind: "stripe", reason: "period_ended" };
      }
      return { hasAccess: true, kind: "stripe", reason: status };
    }
    if (status === S.PAST_DUE) {
      // The 30-day cap is measured from current_period_end: the failed
      // renewal is the one due at the period end, so that is when past_due
      // began. Unknown period end (audit L3) = unknown start = no cap to
      // apply, so deny rather than grant open-ended access. The webhook
      // writes current_period_end from the live subscription on every
      // event, so a real past_due row always has one; no prod row was
      // past_due with a null period end when this changed (2026-10-06).
      if (periodEnd === null) {
        return { hasAccess: false, kind: "stripe", reason: "past_due_unknown_period" };
      }
      if (now > periodEnd + PAST_DUE_GRACE_MS) {
        return { hasAccess: false, kind: "stripe", reason: "past_due_expired" };
      }
      return { hasAccess: true, kind: "stripe", reason: "past_due" };
    }
    // canceled, unpaid, incomplete, incomplete_expired, paused, anything else
    return { hasAccess: false, kind: "stripe", reason: status || "unknown" };
  }

  // ── No Stripe subscription ──────────────────────────────────────────
  // Comped: active with no subscription, access until trial_ends_at (the
  // comp end date; founder accounts are 2099 / 2126).
  if (status === S.ACTIVE) {
    if (trialEnd !== null && now < trialEnd) {
      return { hasAccess: true, kind: "comped", reason: "comped" };
    }
    return { hasAccess: false, kind: "comped", reason: "comp_ended" };
  }

  // Legacy no-card trial (signups before card-required Checkout): access
  // until trial_ends_at, then the paywall with no new trial.
  if (status === S.TRIALING) {
    if (trialEnd !== null && now < trialEnd) {
      return { hasAccess: true, kind: "legacy_trial", reason: "legacy_trial" };
    }
    return { hasAccess: false, kind: "legacy_trial", reason: "legacy_trial_ended" };
  }

  // inactive (new signup before Checkout), expired, canceled, null, ...
  return { hasAccess: false, kind: "none", reason: status || "no_status" };
}

/** True when the user may use the product. See accessDecision. */
export function hasActiveAccess(user, now = Date.now()) {
  return accessDecision(user, now).hasAccess;
}
