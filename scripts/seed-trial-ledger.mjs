#!/usr/bin/env node
// Seed billing_trial_ledger with every existing user (all of them had a
// no-card trial under the old signup), as HMAC hashes. Run once, right
// after migration 20261006130000 and before deploy:
//
//   node --env-file=.env.local --import ./scripts/_ext-loader.mjs \
//     scripts/seed-trial-ledger.mjs            # dry run: prints the count
//   ... scripts/seed-trial-ledger.mjs --apply  # inserts
//
// Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and
// TRIAL_LEDGER_SECRET (the SAME value as production, or the hashes won't
// match at checkout). Uses the app's own trialLedgerKey, so the seed and
// the checkout check can't drift. Idempotent: existing hashes are kept.
// Prints no emails or hashes, only counts.

import { createClient } from "@supabase/supabase-js";
import { trialLedgerKey } from "../src/lib/billing/trial-policy.js";

const APPLY = process.argv.includes("--apply");

for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "TRIAL_LEDGER_SECRET"]) {
  if (!process.env[name]) {
    console.error(`Missing env: ${name}`);
    process.exit(1);
  }
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

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
