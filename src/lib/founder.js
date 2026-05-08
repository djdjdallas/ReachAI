// Founder identity — distinct from `isAdmin` (that's a separate concept
// scoped to internal classifier-feedback tooling). Founder bypass governs
// product gates the founder shouldn't be subject to while dogfooding:
// trial expiry, paywalls, etc.
//
// Configurable via FOUNDER_EMAILS (comma-separated). Falls back to the
// personal admin address when unset, matching the pattern used by
// ADMIN_EMAIL in featureFlags.js.

const RAW = process.env.FOUNDER_EMAILS || "dominickjerell@gmail.com";

export const FOUNDER_EMAILS = RAW.split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export function isFounder(email) {
  if (!email) return false;
  return FOUNDER_EMAILS.includes(String(email).toLowerCase());
}
