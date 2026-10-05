// One trial per person. Server-side only: called from Checkout session
// creation (/api/stripe/create-checkout) and the plan-selection page, which
// show the same decision.
//
// Card-required trial: a new user gets a 7-day Stripe trial on the plan
// they pick, and Stripe owns the clock from then on. A second trial is
// refused when ANY of these hold, checked in this order:
//
//   1. Legacy no-card trial (users.trial_ends_at set, no Stripe
//      subscription). They already had their trial. Decision B
//      (2026-10-05): a legacy user still inside it keeps EXACTLY the
//      remaining days (src/lib/checkout-trial.js, as #38 did); after it
//      ends, they're charged today.
//   2. This Stripe customer has ever had a subscription (any status,
//      including a trial that was canceled).
//   3. The person's email key is in billing_trial_ledger: someone with this
//      email already trialed or subscribed, even under a deleted account
//      (one customer deleted their account and signed up again to get a
//      second trial). The ledger has no foreign key to users, so it
//      survives deletion. It stores only a one-way HMAC-SHA256 of the
//      normalized email (keyed with TRIAL_LEDGER_SECRET), never the email.
//
// Otherwise: a 7-day trial.

import crypto from "node:crypto";
import { planCheckoutTrial } from "@/lib/checkout-trial";

export const TRIAL_DAYS = 7;

/**
 * Normalize an email for trial matching: lowercase, trim, drop a +suffix,
 * and for Gmail (gmail.com / googlemail.com) drop dots and treat both
 * domains as gmail.com, since Gmail delivers all of those variants to the
 * same inbox.
 *
 * @param {string|null|undefined} email
 * @returns {string|null}
 */
export function normalizeEmailForTrial(email) {
  if (typeof email !== "string") return null;
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return null;
  let local = trimmed.slice(0, at);
  let domain = trimmed.slice(at + 1);
  const plus = local.indexOf("+");
  if (plus >= 0) local = local.slice(0, plus);
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  if (!local) return null;
  return `${local}@${domain}`;
}

/**
 * The ledger key for an email: HMAC-SHA256(normalized email,
 * TRIAL_LEDGER_SECRET), hex. One-way, so the ledger holds no email
 * addresses; the secret stops anyone holding a copy of the table from
 * testing guessed emails against it. Server-only (the secret never reaches
 * the client). Throws when the secret is missing, which callers treat as
 * "can't check" and so give no trial.
 *
 * @param {string|null|undefined} email
 * @param {string} [secret]
 * @returns {string|null} null for an unusable email
 */
export function trialLedgerKey(email, secret = process.env.TRIAL_LEDGER_SECRET) {
  const normalized = normalizeEmailForTrial(email);
  if (!normalized) return null;
  if (!secret) throw new Error("TRIAL_LEDGER_SECRET is not set");
  return crypto.createHmac("sha256", secret).update(normalized).digest("hex");
}

/**
 * A short, non-reversible fingerprint of TRIAL_LEDGER_SECRET, so the seed
 * script (local env) and production can be compared without revealing the
 * secret. Different fingerprints = every seeded hash is wrong and every
 * existing user would get a second trial.
 */
export function trialLedgerSecretFingerprint(secret = process.env.TRIAL_LEDGER_SECRET) {
  if (!secret) return null;
  return crypto.createHmac("sha256", secret).update("clinchd-trial-ledger-fingerprint").digest("hex").slice(0, 12);
}

/**
 * Decide the trial for a Checkout session.
 *
 * @param {object} args
 * @param {object} args.user - users row: email, subscription_status,
 *   trial_ends_at, stripe_subscription_id
 * @param {string} args.customerId - this user's Stripe customer
 * @param {object} args.stripe - Stripe client
 * @param {object} args.admin - service-role Supabase client
 * @param {number} [args.now]
 * @returns {Promise<
 *   {mode: "trial", trialPeriodDays: number} |
 *   {mode: "carry", trialEnd: number} |
 *   {mode: "none", reason: string}
 * >}
 */
export async function decideCheckoutTrial({ user, customerId, stripe, admin, now = Date.now() }) {
  // 1. Legacy no-card trial: already used. Carry what's left, or none.
  if (user.trial_ends_at && !user.stripe_subscription_id) {
    const legacy = planCheckoutTrial({
      subscriptionStatus: user.subscription_status,
      trialEndsAt: user.trial_ends_at,
      now,
    });
    return legacy.chargeToday
      ? { mode: "none", reason: "legacy_trial_used" }
      : { mode: "carry", trialEnd: legacy.trialEnd };
  }

  // 2. This customer's own history: any subscription ever.
  if (customerId) {
    const history = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 1,
    });
    if (history.data.length > 0) return { mode: "none", reason: "customer_had_subscription" };
  }

  // 3. The person, across accounts and customers.
  let key;
  try {
    key = trialLedgerKey(user.email);
  } catch {
    // Fail closed: no secret, no way to check, no trial.
    return { mode: "none", reason: "ledger_unavailable" };
  }
  if (key) {
    const { data: ledgerRow, error } = await admin
      .from("billing_trial_ledger")
      .select("email_hash")
      .eq("email_hash", key)
      .maybeSingle();
    // Fail closed: if we can't check, don't hand out a trial.
    if (error) return { mode: "none", reason: "ledger_unavailable" };
    if (ledgerRow) return { mode: "none", reason: "email_had_trial" };
  }

  return { mode: "trial", trialPeriodDays: TRIAL_DAYS };
}

/**
 * Record that this person has trialed or subscribed. Called by the Stripe
 * webhook when a subscription is created. Idempotent (upsert on the email
 * hash; the first record wins).
 */
export async function recordTrialLedger(admin, { email, stripeCustomerId, source }) {
  let key;
  try {
    key = trialLedgerKey(email);
  } catch (err) {
    console.error("[trial-ledger] not recorded:", err?.message);
    return;
  }
  if (!key) return;
  const { error } = await admin
    .from("billing_trial_ledger")
    .upsert(
      { email_hash: key, stripe_customer_id: stripeCustomerId || null, source },
      { onConflict: "email_hash", ignoreDuplicates: true }
    );
  if (error) console.error("[trial-ledger] upsert failed:", error.message);
}
