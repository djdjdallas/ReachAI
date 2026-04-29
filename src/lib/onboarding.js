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
