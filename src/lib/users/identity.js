import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Mask an email for logs / semi-public surfaces: first 3 local chars + *** +
 * domain (e.g. "dom***@example.com"). Returns "" for falsy input.
 */
export function maskEmail(email) {
  if (!email) return "";
  const [local, domain] = String(email).split("@");
  if (!domain) return "***";
  return `${local.slice(0, 3)}***@${domain}`;
}

function fallback(id) {
  return {
    id,
    email: null,
    fullName: null,
    igHandle: null,
    label: id,
    maskedLabel: id,
  };
}

/**
 * Resolve human-readable identity for a set of user ids in a single query, so
 * alerts and logs can name WHICH coach is affected instead of showing a bare
 * UUID. Returns a map keyed by id:
 *   { [id]: { id, email, fullName, igHandle, label, maskedLabel } }
 *
 * - `label`       includes the real email — use on token-gated ops surfaces
 *                 (e.g. /api/alerts/*).
 * - `maskedLabel` masks the email — use in console logs / Vercel output.
 *
 * Never throws: on query failure every id maps to a UUID-only fallback, so this
 * can be dropped into any handler purely for enrichment.
 *
 * @param {object|null} admin - service-role client; falls back to getSupabaseAdmin()
 * @param {string[]} ids
 */
export async function describeUsers(admin, ids) {
  const map = {};
  const unique = [...new Set((ids || []).filter(Boolean))];
  if (unique.length === 0) return map;

  for (const id of unique) map[id] = fallback(id);

  const client = admin || getSupabaseAdmin();
  const { data, error } = await client
    .from("users")
    .select("id, email, full_name, instagram_username")
    .in("id", unique);

  if (error) {
    console.error("describeUsers query failed:", error.message);
    return map;
  }

  for (const row of data || []) {
    const igHandle = row.instagram_username ? `@${row.instagram_username}` : null;
    const email = row.email || null;
    const fullName = row.full_name || null;

    const parts = [];
    if (igHandle) parts.push(igHandle);
    if (fullName && fullName !== igHandle) parts.push(fullName);
    const base = parts.length ? parts.join(" / ") : email || row.id;

    const label = email && base !== email ? `${base} (${email})` : base;
    const maskedLabel =
      email && base !== email
        ? `${base} (${maskEmail(email)})`
        : base === email
          ? maskEmail(email)
          : base;

    map[row.id] = { id: row.id, email, fullName, igHandle, label, maskedLabel };
  }

  return map;
}
