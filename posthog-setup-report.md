# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into Clinchd (Next.js 16.1.6 App Router, JavaScript). The integration covers the full user journey from signup through subscription, using `posthog-js` for client-side tracking, `posthog-node` for server-side webhook events, and the `instrumentation-client.js` pattern for automatic pageview capture. All events are routed through a `/ingest` reverse proxy to avoid ad blockers.

## Files created or modified

| File | Change |
|------|--------|
| `instrumentation-client.js` | Created — initializes PostHog client-side with `/ingest` proxy, exception capture, and debug mode in dev |
| `next.config.mjs` | Added `/ingest` rewrites for PostHog reverse proxy and `skipTrailingSlashRedirect: true` |
| `src/lib/posthog-server.js` | Created — singleton PostHog Node client for use in API routes and webhook handlers |
| `.env.local` | Added `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` |
| `src/app/(auth)/signup/page.js` | Added `identify()` + `user_signed_up` capture after successful signup |
| `src/app/(auth)/login/page.js` | Added `identify()` + `user_logged_in` capture after successful email login |
| `src/app/(dashboard)/billing/page.js` | Added `checkout_started` and `subscription_portal_opened` captures |
| `src/app/(dashboard)/settings/page.js` | Added `ai_agent_toggled` and `instagram_disconnected` captures |
| `src/app/(dashboard)/script-builder/page.js` | Added `script_generated` and `script_saved` captures |
| `src/app/api/webhooks/stripe/route.js` | Added server-side `subscription_activated` and `subscription_canceled` captures via PostHog Node |
| `src/app/api/auth/instagram/callback/route.js` | Added server-side `instagram_connected` capture via PostHog Node |
| `src/app/(onboarding)/onboarding/page.js` | Added `onboarding_step_completed` (steps 2 & 3) and `ai_agent_activated` captures |

## Events instrumented

| Event | Description | File |
|-------|-------------|------|
| `user_signed_up` | User successfully created an account via the signup form | `src/app/(auth)/signup/page.js` |
| `user_logged_in` | User successfully signed in (email/password) | `src/app/(auth)/login/page.js` |
| `checkout_started` | User clicked Subscribe/Upgrade and a Stripe checkout session was created | `src/app/(dashboard)/billing/page.js` |
| `subscription_portal_opened` | User clicked Manage Subscription and was redirected to the Stripe billing portal | `src/app/(dashboard)/billing/page.js` |
| `subscription_activated` | Stripe `checkout.session.completed` — a user's subscription became active | `src/app/api/webhooks/stripe/route.js` |
| `subscription_canceled` | Stripe `customer.subscription.deleted` — a user's subscription was canceled | `src/app/api/webhooks/stripe/route.js` |
| `instagram_connected` | User successfully connected their Instagram account via Unipile OAuth callback | `src/app/api/auth/instagram/callback/route.js` |
| `instagram_disconnected` | User disconnected their Instagram account from settings | `src/app/(dashboard)/settings/page.js` |
| `onboarding_step_completed` | User advanced through a step in the onboarding flow (`step` property: 2 or 3) | `src/app/(onboarding)/onboarding/page.js` |
| `ai_agent_activated` | User toggled the AI agent ON during the onboarding Go Live step | `src/app/(onboarding)/onboarding/page.js` |
| `script_generated` | User generated an AI sales script | `src/app/(dashboard)/script-builder/page.js` |
| `script_saved` | User saved their sales script configuration | `src/app/(dashboard)/script-builder/page.js` |
| `ai_agent_toggled` | User toggled the AI agent on or off from settings (`active` property: true/false) | `src/app/(dashboard)/settings/page.js` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics:** https://us.posthog.com/project/359122/dashboard/1405581
- **Sign Ups & Daily Active Users:** https://us.posthog.com/project/359122/insights/vXF3a5lk
- **Signup to Subscription Funnel:** https://us.posthog.com/project/359122/insights/CSuNyKvQ
- **Subscription Events (Activated vs Canceled):** https://us.posthog.com/project/359122/insights/X2vb6Ew3
- **Onboarding Completion Rate:** https://us.posthog.com/project/359122/insights/ZSmLgKgQ
- **AI Agent & Script Activity:** https://us.posthog.com/project/359122/insights/wiMC5hVe

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
