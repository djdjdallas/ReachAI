// Feature flags for the intent classifier shadow-mode build.
//
// The classifier is gated to the founder account until Meta approves
// `instagram_manage_comments`. The flag lives here so every entry point
// (admin page, API routes) can share a single source of truth.

export const INTENT_CLASSIFIER_SHADOW_MODE = true;

export const ADMIN_EMAIL = "dom@neuralfeeds.com";

export function isIntentClassifierEnabled(userEmail) {
  if (!INTENT_CLASSIFIER_SHADOW_MODE) return false;
  if (!userEmail) return false;
  return userEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}
