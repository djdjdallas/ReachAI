#!/usr/bin/env node
// Fails (exit 1) if any SECURITY DEFINER function in public is executable by
// anon or authenticated without an entry in definer-grants-allowlist.json.
// Read-only: calls public.browser_executable_definer_functions() (migration
// 20261007120000), which reads the catalogs.
//
//   node --env-file=.env.local scripts/check-definer-grants.mjs
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Runs in CI
// on every PR (.github/workflows/db-checks.yml) and after any
// migration.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { compareDefinerGrants } from "../src/lib/db/definer-grants.js";

for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!process.env[name]) {
    console.error(`Missing env: ${name}`);
    process.exit(2);
  }
}

const { allowed } = JSON.parse(
  readFileSync(new URL("./definer-grants-allowlist.json", import.meta.url), "utf8")
);

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data, error } = await db.rpc("browser_executable_definer_functions");
if (error) {
  // Missing function = migration 20261007120000 not run. Fail: an
  // unverifiable check must not pass.
  console.error("Could not list definer functions:", error.message);
  process.exit(2);
}

const { violations, stale } = compareDefinerGrants(data, allowed);
for (const s of stale) console.warn(`allowlist entry no longer exposed (remove it): ${s}`);
if (violations.length) {
  console.error("SECURITY DEFINER functions executable from the browser without an allowlist entry:");
  for (const v of violations) console.error(`  - ${v}`);
  console.error(
    "Revoke in a migration (revoke execute on function public.<fn>(<args>) from public, anon, authenticated;) " +
      "or, if the browser must call it, add it to scripts/definer-grants-allowlist.json with the reason."
  );
  process.exit(1);
}
console.log(`OK: ${data.length} browser-executable definer function(s), all allowlisted.`);
