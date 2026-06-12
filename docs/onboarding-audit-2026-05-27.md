# Clinchd New-Coach Onboarding Audit

_Read-only UX audit, 2026-05-27. Walked signup → first AI reply as a non-technical coach on mobile (380px). No code modified. Citations are `file:line`._

## Summary

- **Critical: 2**
- **High: 11**
- **Medium: 12**
- **Low: 10**
- **Happy-path completability score: 5/10.** A determined coach _can_ finish — the forced onboarding wizard, the plan paywalls, and most empty states are genuinely good. But the path is studded with silent failures (script save, billing checkout, conversation send all fail with `console.error` only), one likely hard wall (Instagram personal-account connect fails with no on-screen explanation), and ambiguity about whether email verification is even enforced. A non-technical coach reads silence as "broken" and churns.
- **Estimated time to "first AI reply to a real lead":** ~45–75 min of setup _if nothing fails_ (signup, 2x OAuth, script, offer, templates, send a manual outbound DM). The first _real_ AI reply then depends on an inbound DM from an actual lead, so realistically same-day-to-days. If the coach has a personal IG account, or hits any of the silent-failure screens, they likely stall indefinitely in session one.

**Self-check answers** are at the bottom.

---

## Happy-Path Walk

The forced spine is: **signup → onboarding wizard (Connect IG → Script → Voice → Preview → Go Live) → dashboard → Settings (Calendly/offer) → send first DM → inbound reply → AI replies.** Middleware enforces the wizard before any dashboard route (`middleware.js:107-142`), which is the right call.

- **Signup** (`(auth)/signup/page.js`) — One clear coral CTA, large tap targets, hero hidden on mobile. But no "check your inbox" step, and it routes straight to `/onboarding` regardless of whether Supabase requires confirmation. _Banned word_: hero says "Monitor qualification rates" (`:136`).
- **Onboarding wizard** (`(onboarding)/onboarding/`) — Strong: real empty-state guidance, industry presets, gated "continue" buttons with helpful tooltips, dismissible inline errors, an honest "Clinchd Can / Cannot" trust checklist on the IG step. But it's riddled with banned words on the most-read screens (Step 2/4/5: "automation", "monitor your DMs 24/7", "chatbot"), the header "Save & Exit" button is dead (`OnboardingHeader.jsx:63-65`), Step 5 has three competing finish buttons, and it never surfaces the IG-connect `error=` params.
- **Dashboard** (`dashboard/page.js`) — For a brand-new coach this is a wall of zeros plus two stacked warning banners (IG-not-connected + trial), with stat cards showing green "+0 this week" deltas that read as fake positivity. The "Connect" CTA competes with "Upgrade." No try/catch around data fetch.
- **Settings** (`settings/page.js`) — Where IG, Calendly, and offer actually live, but buried as cards 2/4/3 in a long unsectioned stack. Best validation/confirmation patterns in the app. Stale "ReachAI" brand name leaks in the disconnect dialog (`:1283`).
- **Script Builder** (`script-builder/page.js`) — Excellent voice-profile UX and script-mode explainer. But every AI/save call only `console.error`s on failure — no user-facing error anywhere.
- **Conversations** (`conversations/page.js`) — Genuinely good mobile master-detail. But the empty state is a passive dead-end for a not-connected coach, and send failures silently revert with no toast.
- **Billing** (`billing/page.js`) — Humane graduated usage copy. But checkout/portal failures are swallowed — the money screen can silently do nothing.

---

## Critical Findings

### C1. Manual/dashboard AI replies bypass trial expiry and plan caps entirely
- **File:** `src/app/api/ai/reply/route.js:11-143` (verified)
- **Screen:** `/conversations` (Send / generate AI reply)
- **Problem:** The route authenticates and rate-limits, then sends — it never reads `subscription_status`, `trial_ends_at`, or the 1,500 cap. The webhook path enforces all of these (`webhooks/instagram/route.js:409-425, 533-552`); this manual path does not. `TrialExpiredModal` is a client-only overlay with a no-op `onOpenChange` (`TrialExpiredGate.jsx:79-80`), so a coach whose trial expired can dismiss it (or hit the endpoint directly) and keep sending DMs and generating AI replies for free.
- **Reproduction:** Let trial lapse → open a conversation → type a reply / click generate → it sends.
- **Fix:** Add the same server-side gate the webhook uses (subscription/trial check + `increment_dm_count`) at the top of `/api/ai/reply`. _(Note: this doesn't block the happy path — it's a revenue leak, not a dead-end — but it's the most serious bug found, so it leads the list.)_

### C2. Email verification flow is ambiguous and has no "check your inbox" step
- **File:** `src/app/(auth)/signup/page.js:47-64` (verified)
- **Screen:** `/signup`
- **Problem:** `signUp()` is called with no `emailRedirectTo`, and on success the code immediately `router.push("/onboarding")`. There is no confirmation screen and no resend-verification UI anywhere in `(auth)/`. There's no `supabase/config.toml` or email-template dir in the repo, so confirmation behavior is whatever the hosted dashboard says. **Both branches are bad:** if confirmation is ON, the session isn't established and middleware bounces the half-authed user from `/onboarding` to `/login` with no explanation; if it's OFF, coaches sign up with typo'd/fake emails that are never reachable (and every drip/welcome email bounces).
- **Reproduction:** Sign up → observe immediate redirect with no inbox prompt; sign up with confirmation ON → get bounced to login.
- **Fix:** Decide the policy explicitly. If confirming: add `emailRedirectTo`, show a "check your inbox" screen, and add a resend affordance. If not: keep, but accept the deliverability risk and verify the DB trigger sets `trialing` + `trial_ends_at` for email/password signups (only the Google callback is confirmed to do so — `callback/route.js:30-42`).

---

## High Findings

### H1. No user-facing error on any Script Builder failure
- **File:** `src/app/(dashboard)/script-builder/page.js:204, 277, 309, 443, 475`
- **Problem:** All four AI calls (analyze-voice, voice-chat, generate-script, save) only `console.error` on failure. If "Generate with AI" or "Save Changes" fails, the spinner stops and nothing happens. A non-technical coach concludes the product is broken at the single most important setup step.
- **Fix:** Surface inline error banners (this page already imports the pattern used elsewhere).

### H2. Instagram personal-account (and other OAuth) failures are silent
- **File:** `instagram/callback/route.js:93-124` redirects to `/onboarding?step=1&error=no_igba_id`; `onboarding/page.js:32-36, 177` never reads `error=`.
- **Problem:** A non-Business account _is_ correctly rejected, but the coach is dropped back on a generic "Connect Your Instagram" screen with zero explanation. Same silent drop for `invalid_state`, `callback_failed`, `auth_failed`. This is the most common real-world connect failure and there's no on-screen guidance to switch to a Business/Creator account.
- **Fix:** Parse `error=` on onboarding + settings and render specific guidance ("You connected a personal account — Clinchd needs an Instagram Business or Creator account. Here's how to switch…").

### H3. Expired/revoked IG token shows "Connected" with no recovery path
- **File:** `settings/page.js:473, 568-572` (status derived only from `!!instagram_business_account_id`); refresh cron at `api/cron/refresh-tokens/route.js:60-63`
- **Problem:** Settings never reads `meta_token_expires_at`, so a dead token still shows a green "Connected" badge. If the proactive refresh fails (user revoked, account dormant past 60 days), sends fail silently (`webhooks/instagram/route.js:1042-1050`) and the coach's only clue is "replies stopped." No expiry banner, no email alert on cron refresh failure.
- **Fix:** Read token expiry in Settings, show a reconnect banner when expired/near-expiry, and alert (email) on refresh-cron failure.

### H4. New free-trial signups receive no welcome/onboarding email
- **File:** `cron/drip/route.js:37, 57` gates the drip to `subscription_status = "active"`; signups start `trialing` (`008_trial_on_signup.sql:23`)
- **Problem:** A coach who closes the tab mid-onboarding has zero email re-engagement until they pay. Major activation loss. (Bonus bug: the drip's welcome email links to `/script`, but the real route is `/script-builder` — `drip-emails.js:122,141` vs `middleware.js:113` — likely a 404.)
- **Fix:** Enroll trialing users in a trial-specific welcome/activation drip; fix the `/script` → `/script-builder` link.

### H5. No guided setup checklist; nav order doesn't reflect the setup sequence
- **File:** `src/components/sidebar.jsx:31-54`; `src/lib/onboarding.js:9-27`; `OnboardingGate.jsx:80-87`
- **Problem:** After the wizard, the coach is dropped into a dashboard of zeros. There's no ordered, progress-tracked checklist — `OnboardingGate` surfaces only one missing item at a time (IG, then Sales Script) and never mentions Calendly, offer, or "send your first DM." Setup-critical links (Sales Script, Settings) are buried in a bottom nav group below 8 feature links. `getOnboardingState` considers a coach "complete" with no Calendly and no offer row.
- **Fix:** Add a persistent "Get set up" checklist (Connect IG → Calendly → Script → Offer → Send first DM) on the dashboard, and re-order/flag the nav.

### H6. Sidebar advertises gated features to everyone — taps lead to a paywall
- **File:** `src/components/sidebar.jsx:31-48`
- **Problem:** "Comment to DM", its "Activity" sub-link, and "Voice Replies" appear unconditionally — no plan check, no lock/"Unlimited"/"Coming soon" badge. A Base-plan coach taps a prominent nav item and lands on a paywall (`comment-to-dm/page.jsx:36-62`). False affordance.
- **Fix:** Add a lock/Unlimited badge so the tap is informed.

### H7. `/conversations` empty state is a dead-end for a not-connected coach
- **File:** `conversations/page.js:763-778`
- **Problem:** Shows "Conversations will appear here" with no explanation that IG isn't connected and no CTA to fix it. The most prominent action on the empty page is "New outreach," which itself requires a connected IG account the coach doesn't have (`:1210-1214`).
- **Fix:** Detect not-connected state and show a "Connect Instagram to start" CTA; disable/guard "New outreach" when not connected.

### H8. Calendar pre-Calendly state has no Connect CTA
- **File:** `calendar/page.js:399-405`
- **Problem:** Before connecting Calendly, the Calendly row shows only a passive "Not connected" pill — no Connect button (unlike Google Calendar, which gets one at `:432-439`). On the screen whose whole value prop is booked calls, the coach has no way to act.
- **Fix:** Add a "Connect Calendly" CTA + "Connect Calendly to see your booked calls" guidance.

### H9. Billing checkout/portal failures are silently swallowed
- **File:** `billing/page.js:114-155`
- **Problem:** `handleSubscribe` / `handleManageSubscription` only `console.error` on a non-`data.url` response or thrown error. On the screen that takes money, the coach clicks "Subscribe," the spinner flashes, and nothing happens.
- **Fix:** Show an error toast/banner on failure.

### H10. Unverified-email login dead-ends with no resend
- **File:** `login/page.js:62-66, 327-331`
- **Problem:** If confirmation is ON, `signInWithPassword` returns the raw "Email not confirmed" string verbatim with no resend-confirmation affordance. Support-ticket generator. (Pairs with C2.)
- **Fix:** Map this error to friendly copy + a "resend confirmation email" button.

### H11. Banned words throughout user-facing copy (Meta-review sensitive)
- **Files:** `Step2Script.jsx:52,60`; `Step4Preview.jsx:476-478`; `Step5GoLive.jsx:81,150,214`; `Step3Voice.jsx:594`; `signup/page.js:136,166`; `login/page.js:142,172`; `dashboard/page.js:276`; `settings/page.js:671,677,1026`; `comment-to-dm/page.jsx:101,129-132`; `comment-triggers/page.jsx:80`; `landing/problem.jsx:15`; `landing/faq.jsx:45`
- **Problem:** "automate/automation/automatically", "monitor/monitored", "chatbot/bot", "automatic booking" appear across onboarding, auth heroes, dashboard, settings, and landing — the exact terms to avoid while Comment-to-DM is in active Meta App Review.
- **Fix:** Sweep and rephrase ("handle", "qualify", "respond", "review"). (Landing SEO keywords/routes may be deliberate — confirm before touching those.)

---

## Medium Findings

- **M1. Voice Replies coverage UI lies under the kill switch.** `VoiceRepliesClient.jsx:104-152` — the kill-switch banner is honest, but the uploader, toggles, and "6/6 intents covered" success UI stay fully interactive and signal success even though nothing sends. _Fix: grey out / mute the coverage metric when the kill switch is active._
- **M2. Comment-to-DM never communicates "pending Meta approval."** Gate is purely plan-based (`comment-to-dm-gate.js:11-16`); an Unlimited-but-unapproved coach picks posts and writes templates believing it's live. _Fix: add a status pill/banner for the Meta-review state._
- **M3. Trial visibility is binary and late.** `TrialExpiredGate.jsx:31-34, 83-98` — no persistent "X days left" indicator; the first signal is a dismissible banner at ≤3 days. No usage-based 75%/90% warning exists (the May-19 "75%/90%" warnings appear to be unimplemented for trials). _Fix: add a persistent trial countdown + earlier warnings._
- **M4. Stale "ReachAI" brand name** in the IG-disconnect dialog (`settings/page.js:1283`).
- **M5. Pricing omits the Unlimited differentiators.** `landing/pricing.jsx:21-37` never lists Voice Replies or Drip Sequences (both Unlimited-gated — `plan.js:23-28, 52-58`); JSON-LD offers also omit them (`page.js:72-81`). _Fix: list Voice Replies (and Drip) in the Unlimited column._
- **M6. Confusing duplicate "offer" model.** `script-builder` writes `script_config.offer` while `/settings/offer` writes the `creator_offers` table — two different "offer" inputs with no explanation of the relationship (`script-builder/page.js`, `OfferForm.jsx`).
- **M7. Settings is a long unsectioned stack.** ~9 cards with no anchors/sectioning; setup-critical connections aren't prioritized or distinguished from optional prefs (`settings/page.js`).
- **M8. Leads + dashboard inline actions are hover-only.** `leads/page.js:349-385` (`opacity-0 group-hover:opacity-100`) and the dashboard inbox `Eye` action (`dashboard/page.js:414`) are unreachable on touch. The Leads inline status dropdown has no mobile equivalent.
- **M9. Calendar has no error state and a cramped mobile grid.** `fetchData` swallows errors into an empty calendar (`calendar/page.js:143-206`); the 7-col month grid with 9px chips doesn't collapse at 380px (`:298-342`).
- **M10. Dead/broken affordances in auth + onboarding.** "Remember me" never reaches `signInWithPassword` (`login/page.js:310-325`); "Save & Exit" has no `onClick` (`OnboardingHeader.jsx:63-65`); Google OAuth has no loading/error handling and silently does nothing on failure (`signup/page.js:30-38`, `login/page.js:39-48`).
- **M11. `update-password` can hang forever on a bad token.** If the recovery session never arrives, the form stays "Verifying reset link…" with no timeout/fallback and no link back to login (`update-password/page.js:161-165`).
- **M12. Legal links are incomplete / missing in-app.** Auth pages link Terms + Privacy but omit Data Deletion (`signup/page.js:396-414`, `login/page.js:399-417`); the dashboard layout and the legal pages themselves render no footer at all, so logged-in pages can't reach `/privacy` or `/data-deletion`. Relevant for Meta App Review, which expects these reachable everywhere.

---

## Low Findings

- **L1.** Stat cards show green "+0 this week" deltas on a zero-data account — reads as fake positivity (`dashboard/page.js:239, 328`).
- **L2.** `comment-triggers` surfaces the raw Graph API error string to the coach (`comment-triggers/page.jsx:25-28, 153`).
- **L3.** Comment Activity fetch error renders identically to the empty state — a DB error looks like "no activity yet" (`activity/page.jsx:55-56`).
- **L4.** Calendar "+N more" opens the day's _first_ event, not the overflowed ones (`calendar/page.js:329-336`).
- **L5.** Leads optimistic status rollback is silent on error (`leads/page.js:150-153`); same pattern for conversation send (`conversations/page.js:409-419`).
- **L6.** Onboarding 5-step tracker crowds at 380px (32px circles, no wrap) (`OnboardingHeader.jsx:19-59`).
- **L7.** Support contact domain mismatch — Step 1 uses `support@clinchd.com`, the rest of the app uses `.io` (`Step1Connect.jsx:223`).
- **L8.** Fabricated social proof — DiceBear placeholder avatars + "Trusted by 100+ creators" / "Sarah Julian, Sales Coach, 12k Followers" (`signup/page.js:176-188`, `Step1Connect.jsx:190-213`). Intentional marketing, flagging for honesty.
- **L9.** Leftover `TODO(post-launch)… removed in <commit-sha>` dead defensive code shipped to prod (`settings/page.js:264-268`, `conversations/page.js:568-571`).
- **L10.** `console.error` noise in render-adjacent handlers across onboarding/dashboard/leads — not user-visible, but worth a logger sweep.

---

## Broken-Path Findings

_Batch-fixable in one PR. Severity in brackets._

1. **[Critical] Expired trial, manual send** — bypasses all gating (C1, `api/ai/reply/route.js`).
2. **[High] Personal IG account** — caught but the `no_igba_id` reason is never shown (H2).
3. **[High] IG token expired/revoked** — "Connected" badge stays green, no reconnect prompt (H3).
4. **[High] Unverified email → login** — raw error, no resend (H10).
5. **[Working — keep] No-Calendly AI booking** — `prompts.js:298-301, 357` instructs the AI to ask for email/best-time and never emit a raw `{{BOOKING_LINK}}`. Graceful.
6. **[Working — keep] Base plan → /voice-replies** — clean upsell, no error (`voice-replies/page.jsx:29-56`).
7. **[Working — keep] Not-connected → dashboard** — `OnboardingGate` amber banner with CTA (`OnboardingGate.jsx:80-101`). _(But `/conversations` is the gap — H7.)_

---

## Pre-Launch Action List (ordered)

1. **Server-side gate on `/api/ai/reply`** (C1) — stops the free-usage leak before paid customers.
2. **Decide + fix the email-verification flow** (C2, H10) — add inbox/resend screens; confirm the trial-row trigger fires for email signups.
3. **Surface IG connect errors** (H2) — the personal-account wall is the most common silent happy-path blocker.
4. **Add user-facing errors to Script Builder and Billing** (H1, H9) — kill the two worst silent-failure screens.
5. **Banned-word sweep** (H11) — fast, low-risk, Meta-review-sensitive.
6. **Add a dashboard setup checklist + nav badges** (H5, H6, H7, H8) — the single biggest activation lever.
7. **IG token-expiry detection + reconnect banner + cron-failure alert** (H3).
8. **Trial welcome/activation drip for trialing users** + fix the `/script` link (H4).
9. Medium polish: kill-switch coverage UI (M1), trial countdown (M3), "ReachAI" rename (M4), Calendly card CTA, legal footers (M12).

---

## What's Working Well

_Don't regress these in the fix PR:_

- **Webhook AI path gating is excellent** — layered subscription/trial/cap/rate-limit checks, atomic `increment_dm_count`, qualifying-loop detection, voice→text fail-open (`webhooks/instagram/route.js`). The manual path (C1) just needs to match it.
- **IG OAuth security** — CSRF `state` cookie, fail-closed webhook HMAC, abort-on-missing-IGBA-ID, tokens encrypted at rest.
- **The forced onboarding wizard** — gated continue buttons with helpful tooltips, industry presets, real empty-state guidance, dismissible inline errors, and a trust-building "Clinchd Can / Cannot" checklist on the IG step.
- **Empty states are a genuine strength** — Comment-to-DM, Activity, Voice Replies, Analytics, Leads, Native Send mostly pair explanatory copy with a next-step CTA.
- **Loading states are consistent** — skeletons on dashboard/conversations/leads, button spinners elsewhere; no janky blank waits.
- **Mobile `/conversations`** — a genuinely good master-detail pattern with back-chevron, scrollable filters, 48px send button.
- **Strong validation/confirmation discipline in Settings** — phone/deal-value validation, type-to-confirm delete, specific OAuth-callback messaging (denied / plan-limit / Calendly free-plan limitation).
- **Native Send** — the best field-level UX in the app (explicit required/optional, specific validation + feedback).
- **Plan paywalls** (voice, comment-to-dm, dm-templates) are a consistent, graceful "Upgrade to Unlimited" pattern, not errors.
- **Playground "Test Mode" / "no real DMs are sent"** is correct, intentional labeling — not a stray debug affordance. No mock data, no TEST MODE banners, no debug buttons shipped anywhere else.
- **Password reset wiring is solid** end-to-end (recovery-session gating, length+match validation, success redirect).
- **Legal content** (privacy/terms/data-deletion) is thorough and Meta-review-aware (human-agent 7-day window, retention table, disconnect flow).

---

## Self-Check

1. **How far would a real coach get alone?** Through the wizard and into the dashboard, yes. They'd stall at one of: a personal-IG-account connect that fails with no explanation (H2); a Script Builder "Generate"/"Save" that silently no-ops (H1); or simply not knowing what to do next on a zeroed-out dashboard with no checklist (H5). Many would not reach a first real AI reply in session one.
2. **Single most important friction point:** **Silent failures on the make-or-break setup screens** — Instagram connect (H2), Script Builder (H1), and Billing (H9) all fail with `console.error` and no on-screen feedback. A non-technical coach interprets silence as "broken" and leaves. If forced to pick _one_: surfacing the Instagram personal-account error (H2), because it's the most common hard wall on the critical-path gate.
3. **Accidentally-shipped debug affordances?** None of consequence. Playground's "Test Mode" is intentional and correct. Residue is limited to `console.error` logging, a `TODO(post-launch)` dead-code comment (L9), and an unused `Bot` icon import. No mock data, no TEST MODE banners.
4. **False affordances (feature looks available but isn't)?** Yes — three: (a) sidebar shows Comment-to-DM + Voice Replies to all plans → paywall (H6); (b) Voice Replies coverage UI signals "6/6 covered / success" while the kill switch nullifies every send (M1); (c) Comment-to-DM shows the full live setup UI to Unlimited coaches whose Meta approval is still pending, with no status indicator (M2).
5. **One screen to redesign tomorrow for max conversion:** the **post-connect dashboard** (`dashboard/page.js`). Today it's a wall of zeros plus two warning banners — the lowest-momentum moment in the funnel. Replace it with a guided activation checklist (Connect IG → Calendly → Script → Offer → Send first DM) with live progress. It directly attacks H5/H7/H8 and gives every other fix a place to surface.
