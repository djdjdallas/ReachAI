// Feature flags for the intent classifier shadow-mode build.
//
// The classifier is gated to the founder account until Meta approves
// `instagram_manage_comments`. The flag lives here so every entry point
// (admin page, API routes) can share a single source of truth.
//
// `ADMIN_EMAIL` is env-driven via `ADMIN_EMAIL` and falls back to the
// founder's personal email so the gate can be swapped without a redeploy.

export const INTENT_CLASSIFIER_SHADOW_MODE = true;

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "dominickjerell@gmail.com";

export function isIntentClassifierEnabled(userEmail) {
  if (!INTENT_CLASSIFIER_SHADOW_MODE) return false;
  if (!userEmail) return false;
  return userEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}
