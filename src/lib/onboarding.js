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

// Subscription states the reply gates serve (webhook + /api/ai/reply).
const SERVING_STATUSES = ["active", "trialing", "past_due"];

// The AI-inactive banner offers "Turn it on", which only helps when turning
// it on would actually make the AI reply: Instagram connected, a serving
// subscription, and ai_mode not already active. A canceled or expired user
// could flip ai_mode and watch the banner vanish while the AI stays silent.
export function shouldShowAiInactiveBanner(profile) {
  return (
    !!profile?.instagram_business_account_id &&
    SERVING_STATUSES.includes(profile.subscription_status) &&
    profile.ai_mode !== "active"
  );
}
