// Single source of truth for "is this user actually ready for the AI to
// respond on their behalf?" Used by the dashboard banner, the first-login
// modal, the AGENT pill, and the ai_mode toggle gate.
//
// Keep this in lockstep with the webhook's silent-skip gates in
// src/app/api/webhooks/instagram/route.js — anything we let through here
// without a warning will be a silent no-reply in production.

export function getOnboardingState(user) {
  const sc = user?.script_config || {};
  const hasGreeting = !!sc.greeting?.toString().trim();
  const hasOffer = !!sc.offer?.toString().trim();
  const hasInstagramConnected = !!user?.instagram_business_account_id;

  const scriptComplete = hasGreeting && hasOffer;
  const complete = scriptComplete && hasInstagramConnected;

  return {
    complete,
    missing: {
      instagram: !hasInstagramConnected,
      script: !scriptComplete,
      greeting: !hasGreeting,
      offer: !hasOffer,
    },
  };
}

// Step 5's ai_mode. `wantsActive` is the user's intent (the toggle, or an
// explicit "Go Live" CTA). The AI is only armed when a greeting exists:
// without one the Instagram webhook silently skips every reply, and an
// 'active' ai_mode would also hide the AI-inactive banner that flags it.
export function resolveOnboardingAiMode({ wantsActive, scriptReady }) {
  return wantsActive && scriptReady ? "active" : "handoff";
}

// The AI-inactive banner offers "Turn it on", which only helps when turning
// it on would actually make the AI reply: Instagram connected, the account
// has access, and ai_mode not already active. A user without access could
// flip ai_mode and watch the banner vanish while the AI stays silent.
// hasAccess comes from the server (GET /api/billing/access); the browser
// never computes access itself.
export function shouldShowAiInactiveBanner(profile, hasAccess) {
  return (
    !!profile?.instagram_business_account_id &&
    hasAccess === true &&
    profile.ai_mode !== "active"
  );
}

// ── Post-connect Instagram auto-import (onboarding) ─────────────────────
// /api/instagram/auto-profile stamps instagram_auto_import_attempted_at when
// it STARTS and instagram_auto_import_finished_at when it ends (~6.5s
// later). The page waits for the finish, in the background, up to a cap.

export const AUTO_IMPORT_WAIT_MS = 20_000;
// An attempt older than this with no finish stamp is treated as dead (or
// predates the finished_at column), so the page doesn't wait on it.
const AUTO_IMPORT_STALE_MS = 2 * 60 * 1000;

/**
 * Should onboarding wait for the auto-import result?
 * @param {object} profile - users row
 * @param {number} [now] - ms since epoch, for tests
 */
export function autoImportPending(profile, now = Date.now()) {
  if (!profile?.instagram_business_account_id) return false;
  if (profile.voice_profile?.status === "ready") return false;
  if (profile.instagram_auto_import_finished_at) return false;
  const attempted = profile.instagram_auto_import_attempted_at;
  if (!attempted) return true; // kicked off by the OAuth callback, not started yet
  return now - new Date(attempted).getTime() < AUTO_IMPORT_STALE_MS;
}

const isBlank = (v) => v == null || (typeof v === "string" && v.trim() === "");

/**
 * Write `updates` over `base`, except that a blank update never replaces a
 * value already saved. Onboarding saves used to rebuild script_config from
 * the form as it was when the page loaded, so a field the auto-import wrote
 * after that (offer, target customer, objections, greeting) was erased by a
 * blank or stale form value.
 */
export function mergeKeepingSaved(base, updates) {
  const out = { ...(base && typeof base === "object" ? base : {}) };
  for (const [key, value] of Object.entries(updates)) {
    if (isBlank(value) && !isBlank(out[key])) continue;
    out[key] = value;
  }
  return out;
}

/**
 * The imported value for a form field, only when the coach hasn't typed
 * anything there yet. Never overwrites what they entered while it ran.
 */
export function fillIfEmpty(current, imported) {
  return isBlank(current) && !isBlank(imported) ? imported : current;
}
