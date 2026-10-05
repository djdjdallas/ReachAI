#!/usr/bin/env node
// Seed billing_trial_ledger with every existing user (all of them had a
// no-card trial under the old signup), as HMAC hashes. Run once, right
// after migration 20261006130000 and before deploy:
//
//   node --env-file=.env.local --import ./scripts/_ext-loader.mjs \
//     scripts/seed-trial-ledger.mjs            # dry run: prints the count
//   ... scripts/seed-trial-ledger.mjs --apply  # inserts
//   ... scripts/seed-trial-ledger.mjs --verify someone@example.com
//                                              # is their row there?
//
// Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and
// TRIAL_LEDGER_SECRET (the SAME value as production, or the hashes won't
// match at checkout). Uses the app's own trialLedgerKey, so the seed and
// the checkout check can't drift. Idempotent: existing hashes are kept.
// Prints no emails or hashes, only counts.

import { createClient } from "@supabase/supabase-js";
import { trialLedgerKey, trialLedgerSecretFingerprint } from "../src/lib/billing/trial-policy.js";

const APPLY = process.argv.includes("--apply");
const verifyAt = process.argv.indexOf("--verify");
const VERIFY_EMAIL = verifyAt >= 0 ? process.argv[verifyAt + 1] : null;

for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "TRIAL_LEDGER_SECRET"]) {
  if (!process.env[name]) {
    console.error(`Missing env: ${name}`);
    process.exit(1);
  }
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Compare this with the fingerprint production reports at
// /api/admin/trial-ledger-check. They must match, or every seeded hash is
// wrong and every existing user silently gets a second trial.
console.log(`secret fingerprint (local): ${trialLedgerSecretFingerprint()}`);

// --verify <email>: is this person's row in the ledger, hashed with THIS
// machine's secret? Proves the seed ran with this secret; only the
// production check (/api/admin/trial-ledger-check) proves production uses
// the same one.
if (verifyAt >= 0) {
  if (!VERIFY_EMAIL) {
    console.error("Usage: --verify <email>");
    process.exit(1);
  }
  const key = trialLedgerKey(VERIFY_EMAIL);
  const { data, error: verifyError } = await db
    .from("billing_trial_ledger")
    .select("source, first_seen_at")
    .eq("email_hash", key)
    .maybeSingle();
  if (verifyError) {
    console.error("Lookup failed:", verifyError.message);
    process.exit(1);
  }
  console.log(data ? `FOUND (source: ${data.source})` : "NOT FOUND");
  process.exit(data ? 0 : 2);
}

const { data: users, error } = await db
  .from("users")
  .select("email, stripe_customer_id, created_at")
  .order("created_at", { ascending: true });
if (error) {
  console.error("Read failed:", error.message);
  process.exit(1);
}

const rows = new Map(); // first (oldest) user per person wins
for (const u of users) {
  const key = trialLedgerKey(u.email);
  if (key && !rows.has(key)) {
    rows.set(key, { email_hash: key, stripe_customer_id: u.stripe_customer_id || null, source: "legacy_backfill" });
  }
}

console.log(`users: ${users.length}, distinct people: ${rows.size}`);
if (!APPLY) {
  console.log("Dry run. Re-run with --apply to insert.");
  process.exit(0);
}

const { error: upsertError } = await db
  .from("billing_trial_ledger")
  .upsert([...rows.values()], { onConflict: "email_hash", ignoreDuplicates: true });
if (upsertError) {
  console.error("Insert failed:", upsertError.message);
  process.exit(1);
}
const { count } = await db.from("billing_trial_ledger").select("email_hash", { count: "exact", head: true });
console.log(`done. ledger rows now: ${count}`);
