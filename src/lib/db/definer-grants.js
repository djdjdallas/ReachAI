// Guard for audit H1: SECURITY DEFINER functions run with the owner's
// rights and bypass RLS, so one the browser can execute (anon or
// authenticated, via PostgREST /rest/v1/rpc/<name>) is a hole unless it was
// meant to be. Nine were open by default before 20261007120000.
//
// The live list comes from public.browser_executable_definer_functions()
// (service role only). This module only compares it with the allowlist;
// scripts/check-definer-grants.mjs does the fetch and exits non-zero.

/**
 * @param {Array<{signature: string, anon_can_execute: boolean, authenticated_can_execute: boolean}>} exposed
 *   rows from browser_executable_definer_functions()
 * @param {Array<{signature: string, roles: string[], reason: string}>} allowlist
 *   scripts/definer-grants-allowlist.json. Each entry names the exact
 *   signature, the roles allowed to execute it, and why.
 * @returns {{violations: string[], stale: string[]}} violations fail the
 *   check; stale entries (allowlisted but no longer exposed) are reported so
 *   the list doesn't rot, without failing.
 */
export function compareDefinerGrants(exposed, allowlist) {
  const allowed = new Map((allowlist || []).map((e) => [e.signature, new Set(e.roles || [])]));
  const violations = [];
  const seen = new Set();

  for (const row of exposed || []) {
    seen.add(row.signature);
    const roles = allowed.get(row.signature) || new Set();
    for (const [role, can] of [
      ["anon", row.anon_can_execute],
      ["authenticated", row.authenticated_can_execute],
    ]) {
      if (can && !roles.has(role)) violations.push(`${row.signature} is executable by ${role}`);
    }
  }

  const stale = [...allowed.keys()].filter((sig) => !seen.has(sig));
  return { violations, stale };
}
