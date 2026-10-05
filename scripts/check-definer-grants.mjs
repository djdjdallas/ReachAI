#!/usr/bin/env node
// Fails (exit 1) if any SECURITY DEFINER function in public is executable by
// anon or authenticated without an entry in definer-grants-allowlist.json.
//
// Reads the rows of public.browser_executable_definer_functions() as JSON
// (a file argument, or stdin). The rows come from psql connected as
// ci_grant_reader (migration 20261007140000), a catalog-only login: no
// service-role key involved.
//
//   psql "$SUPABASE_CI_DB_URL" -X -tA -v ON_ERROR_STOP=1 \
//     -c "select coalesce(json_agg(t), '[]') from public.browser_executable_definer_functions() t" \
//     | node scripts/check-definer-grants.mjs
//
// Runs in CI (.github/workflows/db-checks.yml) when SUPABASE_CI_DB_URL is
// set.

import { readFileSync } from "node:fs";
import { compareDefinerGrants } from "../src/lib/db/definer-grants.js";

const input = process.argv[2] ? readFileSync(process.argv[2], "utf8") : readFileSync(0, "utf8");

let rows;
try {
  rows = JSON.parse(input.trim());
  if (!Array.isArray(rows)) throw new Error("expected a JSON array");
} catch (err) {
  // Empty or garbled input (psql failed, migration not run): an
  // unverifiable check must not pass.
  console.error("Could not read definer function rows:", err.message);
  process.exit(2);
}

const { allowed } = JSON.parse(
  readFileSync(new URL("./definer-grants-allowlist.json", import.meta.url), "utf8")
);

const { violations, stale } = compareDefinerGrants(rows, allowed);
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
console.log(`OK: ${rows.length} browser-executable definer function(s), all allowlisted.`);
