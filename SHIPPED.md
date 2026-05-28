# Clinchd — Shipped Features

This file is the source of truth for what's been built and is live in production. Before proposing a new feature, check here first.

**How to read this:** Each entry includes the feature name, what it does, where the code lives, and any required external config (env vars, third-party dashboard settings, etc.).

**How to update this:** After shipping any feature that changes behavior, persists data, or adds infrastructure, add an entry below. One-line summary in the table, then a section below with details. Date format: YYYY-MM-DD. Dates come from `git log --reverse` on the primary file unless noted.

---

## Quick reference table

| Feature | Status | Last updated | Section |
|---|---|---|---|
| Instagram OAuth + webhook receiver | LIVE | 2026-03-27 | [link](#instagram-oauth--webhook-receiver) |
| AI agent (qualifying + reply gen) | LIVE | 2026-05-14 | [link](#ai-agent-qualifying--reply-gen) |
| AI model split (Sonnet user-facing, Haiku triage) | LIVE | 2026-05-14 | [link](#ai-model-split-sonnet-user-facing-haiku-triage) |
| Intent classifier (NOT_A_LEAD aware) | LIVE | 2026-05-14 | [link](#intent-classifier-not_a_lead-aware) |
| Qualifying-loop circuit breaker | LIVE | 2026-05-14 | [link](#qualifying-loop-circuit-breaker) |
| Outreach composer (founder-initiated) | LIVE | 2026-05-07 | [link](#outreach-composer-founder-initiated) |
| Founder bypass (isFounder helper) | LIVE | 2026-05-07 | [link](#founder-bypass-isfounder-helper) |
| Trial-expired modal + 3-day banner | LIVE | 2026-05-07 | [link](#trial-expired-modal--3-day-banner) |
| Trial signup + DB trigger (7-day) | LIVE | 2026-04-10 | [link](#trial-signup--db-trigger-7-day) |
| Stripe checkout + subscription | LIVE | 2026-02-27 | [link](#stripe-checkout--subscription) |
| Resend onboarding drip | LIVE | 2026-04-12 | [link](#resend-onboarding-drip) |
| Twilio SMS notifications | LIVE | 2026-04-12 | [link](#twilio-sms-notifications) |
| Calendly OAuth + webhook receiver | LIVE (paid-plan gated) | 2026-04-24 | [link](#calendly-oauth--webhook-receiver) |
| Google Calendar OAuth + events read | LIVE | 2026-04-05 | [link](#google-calendar-oauth--events-read) |
| Sales script builder + Generate AI | LIVE | 2026-02-27 | [link](#sales-script-builder--generate-ai) |
| Voice profile (Instagram-driven) | LIVE | 2026-03-27 | [link](#voice-profile-instagram-driven) |
| Onboarding flow (5 steps) | LIVE | 2026-04-07 | [link](#onboarding-flow-5-steps) |
| Comment intent classifier (shadow) | ADMIN-ONLY | 2026-04-20 | [link](#comment-intent-classifier-shadow) |
| SEO landing pages (~31 URLs) | LIVE | 2026-05-05 | [link](#seo-landing-pages-31-urls) |
| GSAP homepage animations | LIVE | 2026-05-02 | [link](#gsap-homepage-animations) |
| In-app notifications dropdown | LIVE | 2026-04-12 | [link](#in-app-notifications-dropdown) |
| Hot-lead + booking email alerts | LIVE | 2026-04-12 | [link](#hot-lead--booking-email-alerts) |
| Token refresh cron | LIVE | 2026-03-27 | [link](#token-refresh-cron) |
| Encryption helper (AES-256-GCM) | LIVE | 2026-02-27 | [link](#encryption-helper-aes-256-gcm) |
| Voice Replies + DM intent classifier | LIVE (Unlimited plan, kill-switch gated) | 2026-05-20 | [link](#voice-replies--dm-intent-classifier) |

---

## Detailed entries

### Voice Replies + DM intent classifier

**Date:** 2026-05-20

**What it is.** Paying coaches on the Unlimited plan can upload short
m4a/mp3/wav/ogg voice memos tagged with an intent class. When a lead's
incoming DM matches the intent, the AI sends the coach's pre-recorded
audio in place of a text reply. Hard product rule: coach-uploaded audio
only — no AI-generated, cloned, or synthesized voices.

**New DM-side AI classifier.** This release also introduces the first
real DM intent classifier in the codebase: `classifyDMIntent` in
`src/lib/dm-intent.js`. Architectural twin of `classifyComment` (Haiku
4.5, forced tool use, ephemeral prompt cache, XML-escaped untrusted
input, 8-second `Promise.race` timeout, multilingual + prompt-injection
defense). Seven classes: `warm_intent`, `objection_price`,
`objection_time`, `objection_trust`, `booking_cta`, `follow_up`,
`do_not_send`. Runs on every inbound DM regardless of `human_in_loop`.

**Where the code lives.**

- `src/lib/dm-intent.js` — the classifier
- `src/lib/voice/snippets.js` — list/create/toggle/delete + signed
  playback URLs
- `src/lib/voice/matcher.js` — kill-switch + do_not_send gate +
  snippet lookup + 10-minute send URL
- `src/lib/voice/sender.js` — Meta audio POST + `voice_send_log`
  writer + send-count RPC bump
- `src/lib/instagram.js` — new `sendInstagramAudio` sibling to
  `sendInstagramMessage`
- `src/lib/plan.js` — `canUseVoiceReplies(user)` Unlimited gate
- `src/app/api/voice-snippets/{route,[id]/route,[id]/playback-url/route,upload-url/route}.js`
- `src/app/api/webhooks/instagram/route.js` — Insertion A (classifier
  + do_not_send pause) and Insertion B (voice routing) inside
  `processIncomingMessage`
- `src/app/(dashboard)/voice-replies/{page,VoiceRepliesClient}.jsx`
- `src/components/voice/{VoiceUploader,VoiceSnippetCard}.jsx`

**Schema (migrations 20260520120000 + 20260520120100).**

- `users.voice_replies_enabled` (boolean, default `true`) — per-user
  kill switch
- `messages.intent_classification` (jsonb) — DM classifier output
- `voice_snippets` (id, user_id, intent_class, label, storage_path,
  duration_ms, mime_type, file_size_bytes, transcript, is_active,
  send_count, consent_acknowledged_at, created_at, updated_at) — RLS
  on `auth.uid() = user_id`; partial unique index on
  `(user_id, intent_class) WHERE is_active = true`
- `voice_send_log` (id, user_id, voice_snippet_id, conversation_id,
  recipient_psid, intent_class, send_status, error_message, sent_at)
  — RLS select-only; writes are service-role
- RPC `increment_voice_send_count(snippet_id uuid)`
- Storage bucket `voice-snippets` (private, 5 MB cap, audio mime
  types) with insert/select/delete policies gating on
  `(storage.foldername(name))[1] = auth.uid()::text`

**Webhook integration.** Two insertions in `processIncomingMessage`:

1. **Insertion A** — `classifyDMIntent` runs always, persists output
   on the `messages` row, and fires `dm_intent_classified` PostHog.
   On `do_not_send` with confidence ≥ 0.7, pauses the conversation
   with `ai_pause_reason = 'hostile_or_refund'` and logs
   `skipped_do_not_send` to `voice_send_log`.
2. **Insertion B** — after `buildSystemPrompt` but before
   `generateReply`. If `dmIntent.confidence >= 0.5` and the matcher
   finds an active snippet for the class, reserves the outbound DM
   slot via `check_and_record_outbound`, signs a 10-minute URL, POSTs
   to Meta as an audio attachment, inserts a visible messages row
   (`[voice reply: <label>]`), fires `ai_reply_sent` with
   `reply_mode: 'voice'`, and returns. Any failure falls through to
   the existing text reply path.

**Plan gating.** `canUseVoiceReplies(user)` returns true for founders
(via `isFounder`) OR for `plan === 'unlimited'` with
`subscription_status ∈ ['active', 'trialing']`. Founder bypass
governs the subscription gate ONLY — the per-user kill switch
(`voice_replies_enabled`) is enforced inside the matcher even for
founders.

**Pre-deploy.** Run the commented-out
`UPDATE public.users SET voice_replies_enabled = false WHERE email = 'highflyinnick@gmail.com';`
in the Supabase SQL editor BEFORE making the page accessible — keeps
the Meta App Review test account out of the voice path.

**Followups deferred** (`docs/dm-intent-router-followups.md`): the
audit also flagged 4 issues in the existing
`classifyIncomingMessage` (no injection defense, sub-cache-min
prompt, no SDK timeout, English-only). The new `dm-intent.js` fixes
all four for itself; backport into `classifyIncomingMessage` after
Meta App Review concludes.

### Instagram OAuth + webhook receiver
- **Code:** `src/app/api/auth/instagram/{route.js,callback/route.js,disconnect/route.js}`, `src/app/api/webhooks/instagram/route.js`, `src/lib/instagram.js`
- **Migrations:** `supabase/migrations/001_initial_schema.sql` (users + conversations + messages), `003_unipile_migration.sql`, `013_drop_unipile_columns.sql`
- **Env required:** `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`, `NEXT_PUBLIC_APP_URL`, `ENCRYPTION_KEY`
- **External config:** Meta App Dashboard → Webhooks → Instagram subscription, OAuth redirect URI matches `${NEXT_PUBLIC_APP_URL}/api/auth/instagram/callback`
- **Notes:** Uses Instagram API with Instagram Login (Meta Official path), migrated from Unipile on 2026-03-27. Tokens AES-256-GCM encrypted via `src/lib/token-utils.js`. "Connected Tools" toggle is included in OAuth consent — no separate in-app step needed for new users.

### AI agent (qualifying + reply gen)
- **Code:** `src/app/api/ai/reply/route.js`, `src/app/api/webhooks/instagram/route.js` (inline reply generation in the webhook), `src/lib/prompts.js`, `src/lib/anthropic.js`
- **Modes:** `users.ai_mode` column — `'active' | 'handoff' | 'off'` (migration `009_ai_mode.sql`)
- **Flow:** Inbound DM → classifier → loop guard → generateReply → sendInstagramMessage
- **Identity rules:** Never volunteer AI status, never tell prospect to "qualify themselves", back off after qualifying-loop detection
- **Notes:** `ai_paused` column on conversations gates auto-reply. `ai_pause_reason` tracks why (migration `007_ai_pause_reason.sql`). Outreach gate (2026-05-07): the agent only auto-replies to threads where the founder sent the first message.

### Intent classifier (NOT_A_LEAD aware)
- **Code:** `src/lib/classifier.js`, called from `src/app/api/webhooks/instagram/route.js`
- **Migration:** `supabase/migrations/20260420120000_intent_classifier_shadow.sql`
- **Notes:** Originally shipped as shadow-mode scaffolding 2026-04-20. NOT_A_LEAD bucket + production-routing added 2026-05-14 (commit `3984822`). Pauses the agent when classifier returns NOT_A_LEAD.

### AI model split (Sonnet user-facing, Haiku triage)
- **Code:** `src/lib/anthropic.js`
- **Env required (kill switches):** `CLASSIFY_INCOMING_MODEL` (default `claude-haiku-4-5-20251001`), `SUMMARIZE_CONVERSATION_MODEL` (default `claude-haiku-4-5-20251001`)
- **Migrated 2026-05-14:** `classifyIncomingMessage` and `summarizeConversation` moved from `claude-sonnet-4-6` to `claude-haiku-4-5-20251001`. Both are high-volume structured-output calls (DM triage runs on every inbound message, summarizer is a background task) where Haiku matches Sonnet quality at lower cost.
- **Rollback:** Set the env var above to `claude-sonnet-4-6` in Vercel and redeploy — no code change required. Designed for instant revert if classification quality degrades.
- **Kept on Sonnet 4.6 (intentional):** `generateReply` (DM agent voice), `generateScript` (sales script generation), `analyzeVoice` + `analyze-instagram-voice.js` (voice profile), `generateVoiceChatReply` (interview flow). All user-facing — quality regressions would be customer-visible.
- **Telemetry:** `[classifyIncomingMessage]` / `[summarizeConversation]` structured Vercel logs every call (model + tokens + latency). PostHog events `classify_incoming_message` and `conversation_summarized` carry `{ model, latency_ms, input_tokens, output_tokens, ...class_field }` for Haiku-vs-Sonnet behavior comparison over the 2-week soak.

### Qualifying-loop circuit breaker
- **Code:** `src/app/api/webhooks/instagram/route.js:133` (heuristic detector), `~:418-433` (guard + PostHog `qualifying_loop_detected` event)
- **Notes:** v1 is heuristic (no embeddings). Sets `ai_paused=true` and `ai_pause_reason='qualifying_loop_detected'` when the agent has asked the same kind of question repeatedly. Shipped 2026-05-14.

### Outreach composer (founder-initiated)
- **Code:** `src/app/api/outreach/start/route.js`
- **Notes:** Founder enters an IG handle → resolves IGSID via `resolveUsernameToIgsid` → sends initial DM → creates conversation row with `ai_paused=false`. This is what the agent uses as its "permission to auto-reply" gate. Shipped 2026-05-07.

### Founder bypass (isFounder helper)
- **Code:** `src/lib/founder.js`
- **Env required:** `FOUNDER_EMAILS` (comma-separated)
- **Notes:** Used by `src/components/app/TrialExpiredGate.jsx` to skip the trial paywall for the founder's own account. Shipped 2026-05-07.

### Trial-expired modal + 3-day banner
- **Code:** `src/components/app/TrialExpiredModal.jsx`, `src/components/app/TrialExpiredGate.jsx`
- **Notes:** Hard-blocks expired trials and warns 3 days before expiry. Founder bypass via `isFounder()`. Shipped 2026-05-07.

### Trial signup + DB trigger (7-day)
- **Code:** `src/app/(auth)/signup/page.js` (signup UI), `supabase/migrations/008_trial_on_signup.sql` (trigger)
- **Migration:** `008_trial_on_signup.sql` — `handle_new_user()` trigger sets `subscription_status='trialing'` and `trial_ends_at=NOW()+7 days` on every new auth user.
- **Notes:** Plan defaults to `'base'`. Migration was shipped 2026-04-10.

### Stripe checkout + subscription
- **Code:** `src/app/api/webhooks/stripe/route.js`, `src/lib/stripe.js`, `src/app/(dashboard)/billing/page.js`
- **Env required:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_BASE_PRICE_ID`, `STRIPE_UNLIMITED_PRICE_ID`
- **External config:** Stripe Dashboard → Webhooks → endpoint `${NEXT_PUBLIC_APP_URL}/api/webhooks/stripe`, listens for subscription events.
- **Notes:** Two-tier plans (Base, Unlimited). Plan logic in `src/lib/plans.js` includes the Comment-to-DM feature flag (`NEXT_PUBLIC_COMMENT_TO_DM_VISIBLE`).

### Resend onboarding drip
- **Code:** `src/app/api/cron/drip/route.js`, `src/lib/drip-emails.js`
- **Migration:** `010_notifications.sql` (`email_events` table for dedup), `users.drip_enrolled_at`, `users.drip_step`
- **Env required:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CRON_SECRET`
- **External config:** Vercel cron job hits `/api/cron/drip` on a schedule (check `vercel.json`); DNS/DKIM on the Resend sending domain
- **Notes:** Shipped 2026-04-12.

### Twilio SMS notifications
- **Code:** `src/lib/notifications.js` (`sendSms`, `sendHotLeadAlert`, `sendBookingAlert`)
- **Env required:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- **User columns:** `phone_number`, `notify_hot_leads_sms`, `notify_bookings_sms` (migration `010_notifications.sql`)
- **Notes:** Fire-and-forget — never throws, errors logged. E.164 normalisation in `sendSms`. SMS is opt-in only. Shipped 2026-04-12.

### Calendly OAuth + webhook receiver
- **Code:** `src/app/api/auth/calendly/{route.js,callback/route.js,disconnect/route.js}`, `src/app/api/webhooks/calendly/route.js`, `src/lib/calendly.js`
- **Migrations:** `006_bookings_calendly.sql` (bookings schema extension), `017_bookings_update_rls.sql` (missing UPDATE policy), `018_calendly_oauth.sql` (per-user OAuth + signing-key columns)
- **Env required:** `CALENDLY_CLIENT_ID`, `CALENDLY_CLIENT_SECRET`, `NEXT_PUBLIC_APP_URL`, `ENCRYPTION_KEY`
- **External config:** Calendly Developer console → OAuth redirect URI = `${NEXT_PUBLIC_APP_URL}/api/auth/calendly/callback`. Webhook subscriptions require a paid Calendly plan (free-plan users still get `calendly_url` populated for DM templating, but no booking persistence).
- **Notes:** HMAC-SHA256 signature verification on raw body, `crypto.timingSafeEqual`, 300s replay window. Idempotent via unique partial index on `bookings.calendly_event_uri`. **Known gaps (see `posthog-setup-report.md` and audit on branch `claude/build-reachai-app-PeuJk`):** Calendly webhook does NOT fire `sendBookingAlert` (notifications gap), does NOT set `ai_paused=true` on the matched conversation, and does NOT fire PostHog `booking_created`. Conversation-id matching is fragile (substring match on `sender_name`). Webhook OAuth shipped 2026-04-24; the receiver itself shipped 2026-04-05.

### Google Calendar OAuth + events read
- **Code:** `src/app/api/auth/google-calendar/{route.js,callback/route.js}`, `src/app/api/google-calendar/events/route.js`, `src/lib/google-calendar.js`
- **Migration:** `006_bookings_calendly.sql` Section F (Google Calendar token columns on users)
- **Env required:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_APP_URL`
- **External config:** Google Cloud Console → OAuth client → authorized redirect URI matches the callback route
- **Notes:** Read-only events surfaced on `/calendar` alongside Calendly bookings. Token refresh handled in `src/lib/google-calendar.js`. Shipped 2026-04-05.

### Sales script builder + Generate AI
- **Code:** `src/app/(dashboard)/script-builder/page.js`, `src/app/api/ai/generate-script/route.js`, `src/lib/prompts.js`
- **Env required:** `ANTHROPIC_API_KEY`
- **DB:** `users.script_config` (JSONB) with `booking_message` field that uses the `{{BOOKING_LINK}}` placeholder
- **Notes:** "Generate AI" button calls `/api/ai/generate-script` to compose a starter script. The `{{BOOKING_LINK}}` substitution happens at reply generation time using `users.calendly_url`. Shipped 2026-02-27.

### Voice profile (Instagram-driven)
- **Code:** `src/app/api/ai/analyze-voice/`, `src/lib/anthropic/analyze-instagram-voice.js`, `src/app/(onboarding)/onboarding/components/Step3Voice.jsx`
- **Migration:** `migrations/add_voice_profile.sql` (legacy migrations dir)
- **Notes:** Analyzes the founder's recent IG captions on connect to extract tone/voice. Auto-imports during onboarding (commit `b0fe63b` 2026-05-13). Stored on `users.voice_profile`. Initial ship 2026-03-27.

### Onboarding flow (5 steps)
- **Code:** `src/app/(onboarding)/onboarding/page.js`, `src/app/(onboarding)/onboarding/components/Step{1..5}*.jsx`
- **Notes:** Redesigned 2026-04-07. Recent changes: unified footer with single Continue (`0046794` 2026-05-14), removed Connected Tools card (`6a1ceff` 2026-05-14), auto voice import on Instagram connect (`b0fe63b` 2026-05-13).

### Comment intent classifier (shadow)
- **Code:** `src/app/api/admin/classify/route.js`, `src/app/api/admin/classify/feedback/`
- **Migration:** `20260420120000_intent_classifier_shadow.sql`
- **Env required:** `ADMIN_EMAIL` (gates the admin route)
- **Notes:** Admin-only shadow-mode scaffolding. Not wired into a customer-facing webhook. Feature flag `NEXT_PUBLIC_COMMENT_TO_DM_VISIBLE` controls Comment-to-DM plan visibility (gated to Unlimited tier). Shipped 2026-04-20.

### SEO landing pages (~31 URLs)
- **Code:** `src/app/page.js` (home), `src/app/compare/*/page.js` (11 vs/alternative pages), `src/app/faq/*/page.js` (4 FAQs), `src/app/for/[niche]/page.js` (dynamic niche pages), root product pages (`ai-dm-setter`, `book-discovery-calls-from-instagram`, `instagram-dm-automation-for-coaches`, `instagram-lead-qualification`, `qualify-leads-on-instagram`, etc.)
- **Notes:** Initial SEO architecture 2026-03-24, 31-page build-out 2026-05-05 (commit removed fabricated testimonials). Sitemap auto-generated by `src/app/sitemap.js`. `/for/[niche]` routes are added to public-route allowlist for crawlability.

### GSAP homepage animations
- **Code:** `src/components/landing/animations/{HeroDemo,QualifyDM,DMConversation,BookingConfirmed,AgentStats,AlwaysOn,ConnectSetup}.jsx`, `src/components/landing/{features,how-it-works,integrations,trusted-by}.jsx`
- **Notes:** GSAP scroll-driven animations on the home landing. Initial ship 2026-03-24, ongoing tweaks through 2026-05-02.

### In-app notifications dropdown
- **Code:** `src/app/api/notifications/route.js`
- **Migration:** `011_notification_read.sql`
- **Notes:** Shipped 2026-04-12.

### Hot-lead + booking email alerts
- **Code:** `src/lib/notifications.js` (`sendHotLeadAlert`, `sendBookingAlert`)
- **Fires from:** `src/app/api/webhooks/instagram/route.js:596-601` when status flips to `interested` or `booked` via AI-reply heuristic detection
- **User columns:** `notify_hot_leads_email`, `notify_bookings_email` (default `true`)
- **Notes:** Dedup via `email_events` table. **Gap:** does NOT fire from the Calendly webhook (see Calendly section). Shipped 2026-04-12.

### Token refresh cron
- **Code:** `src/app/api/cron/refresh-tokens/route.js`
- **Env required:** `CRON_SECRET`
- **External config:** Vercel cron hits this endpoint to refresh Instagram long-lived tokens before they expire
- **Notes:** Shipped 2026-03-27 with the Meta Official API migration.

### Encryption helper (AES-256-GCM)
- **Code:** `src/lib/encryption.js`, `src/lib/token-utils.js`
- **Env required:** `ENCRYPTION_KEY` (32-byte hex)
- **Notes:** Used for `meta_page_access_token`, `calendly_access_token`, `calendly_refresh_token`, `calendly_webhook_signing_key`, `google_calendar_*_token`. `token-utils.js` is transparent — accepts both plaintext (legacy) and encrypted values on read.

---

## Known gaps / not yet built

This section lists things commonly confused for shipped but NOT yet built. Update when sessions reveal new gaps.

- **Booking notifications from Calendly webhook** — `sendBookingAlert` fires only on the Instagram heuristic, NOT on the actual Calendly `invitee.created` event. Audit on branch `claude/build-reachai-app-PeuJk`.
- **`ai_paused=true` on Calendly-driven bookings** — Calendly webhook flips `conversations.status='booked'` but doesn't pause the agent. Risk: agent keeps replying after a conversion.
- **PostHog `booking_created` event** — does not fire anywhere. Funnel analytics for Calendly bookings are blind.
- **Calendly admin debug view** — no in-app surfacing of raw webhook payloads; founder must read Vercel logs.
- **Calendly subscription dedupe on reconnect** — OAuth callback creates a new subscription without deleting the old one. Risk: orphaned webhooks on Calendly side.
- **Late opt-in toggle** (cold inbound → agent takeover) — NOT built, deferred.
- **Affiliate/referral program** (Rewardful) — NOT built, deferred until 10 paying users.
- **Deepgram Nova-3 transcription** for intent classifier v1.5 — NOT built, triggered at 20 paying users or F1 < 0.78.
- **Comment-to-DM webhook integration** — classifier scaffolding in shadow mode only; no production wiring.
- **"Intent" tier ($297/month)** — pricing not active in `src/lib/plans.js`.

---

## External configuration checklist (for new environments)

When deploying Clinchd to a new environment, these must be configured outside the code.

### Vercel environment variables
Confirmed by `grep -rh "process.env\." src/ | grep -oE "process\.env\.[A-Z_][A-Z_0-9]+" | sort -u` as of 2026-05-14:

```
ADMIN_EMAIL
ANTHROPIC_API_KEY
CALENDLY_CLIENT_ID
CALENDLY_CLIENT_SECRET
CRON_SECRET
ENCRYPTION_KEY
FOUNDER_EMAILS
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
INSTAGRAM_APP_ID
INSTAGRAM_APP_SECRET
INSTAGRAM_WEBHOOK_VERIFY_TOKEN
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_COMMENT_TO_DM_VISIBLE
NEXT_PUBLIC_POSTHOG_HOST
NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SUPABASE_URL
RESEND_API_KEY
RESEND_FROM_EMAIL
STRIPE_BASE_PRICE_ID
STRIPE_SECRET_KEY
STRIPE_UNLIMITED_PRICE_ID
STRIPE_WEBHOOK_SECRET
SUPABASE_SERVICE_ROLE_KEY
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER
```

### Third-party dashboard configuration
- **Meta for Developers:** Instagram webhook subscription, OAuth redirect URI = `${NEXT_PUBLIC_APP_URL}/api/auth/instagram/callback`. Webhook callback URL = `${NEXT_PUBLIC_APP_URL}/api/webhooks/instagram`.
- **Calendly Developer:** OAuth redirect URI = `${NEXT_PUBLIC_APP_URL}/api/auth/calendly/callback` (NOT the webhook URL — webhooks are created dynamically per-user via API).
- **Stripe:** Webhook endpoint = `${NEXT_PUBLIC_APP_URL}/api/webhooks/stripe`, listens for subscription + trial events.
- **Supabase:** RLS enforced on all user-scoped tables. Migrations under `supabase/migrations/` (numbered 001..022 plus timestamped); founder runs them manually via SQL editor.
- **Twilio:** Geo permissions enabled for SMS destinations; `TWILIO_PHONE_NUMBER` must be SMS-capable.
- **Resend:** DNS/DKIM configured on the sending domain (matches `RESEND_FROM_EMAIL`).
- **Google Cloud:** OAuth client for Calendar, redirect URI = `${NEXT_PUBLIC_APP_URL}/api/auth/google-calendar/callback`.
- **Vercel:** `NEXT_PUBLIC_APP_URL` MUST be the production URL, NOT a preview deployment URL — Calendly stores the webhook URL inside the subscription at creation time and never updates it.

---

## How sessions should use this file

1. At the start of any session involving a feature request, open this file first.
2. If the requested feature appears in the Quick Reference table → check the Detailed Entries section for current state before proposing new work.
3. If the feature appears in "Known gaps / not yet built" → confirm the gap still exists, then propose the build.
4. If the feature isn't listed at all → it's either truly new OR documentation drifted. Confirm with the founder before committing significant work.

---

## Changelog

### 2026-05-21 — Comment-to-DM bracket substitution fix
- **Bug:** Coach saved a template like `hey [dominickjerell] heres the offer`. The renderer (`renderTemplate` in `src/lib/comment-trigger-rules.js`) only substitutes the four `{{TOKEN}}` placeholders, so the bracketed lowercase handle and the literal word "offer" were delivered to the lead verbatim. The editor already had a bracket-syntax warning, but it only fired for `[UPPERCASE]` tokens that matched a known name — `[dominickjerell]` (lowercase, unknown name) slipped through with zero feedback.
- **Fix:** (1) Broadened the editor's bracket regex to `/\[([A-Za-z_][A-Za-z0-9_]*)\]/g` and split matches into two buckets — known names still get the one-click Convert button (now case-insensitive, normalizes to `{{UPPERCASE}}`); unknown names get a new soft warning panel listing the offending tokens and pointing at the available-tokens reference. (2) Added a server-side-only `console.warn` in `renderTemplate` when any `[bracketed_token]` survives substitution, so the next stray template shows up in logs without a user report. No schema changes, no DM hot-path changes, no API behavior changes — Meta App Review test path is byte-identical for correctly-written templates.
- **Files:** `src/app/(dashboard)/dm-templates/TemplateEditor.jsx`, `src/lib/comment-trigger-rules.js`
- **Verified:** `npm run build` ✓, `npx eslint` on both modified files ✓ (no findings), no Meta App Review impact.

## 2026-05-27 — Drip Sequences v1 (Version A: in-window nudges)
- New tables: dm_drip_templates, dm_drip_queue
- New columns: users.drip_enabled (default false), users.drip_delay_hours (default 18, CHECK 6-22)
- messages.source extended to allow 'drip'
- New page: /drip-sequences (Unlimited-gated, deploy-dark)
- New cron: /api/cron/drip-process every 15 minutes (Vercel Pro required)
- New PostHog events: drip_scheduled, drip_canceled, drip_fired
- Text-only for v1 (no voice drips)
- One drip per conversation enforced via partial unique index
  (drip_queue_one_active_per_conversation, scoped to scheduled/processing)
- 24-hour Meta window: enforced via drip_delay_hours CHECK (6-22)
  AND 23.5h safety check in processor before send
- 8 conditions re-verified at fire time, every drip
- Stripe webhook updated: drip_enabled flipped false on downgrade/cancel,
  scheduled drips canceled
- Default OFF for all users including founder — opt-in via UI
- DEPLOY NOTE: requires CRON_SECRET env var in Vercel; */15 cron requires
  Vercel Pro. If on Hobby, move to Supabase pg_cron. (vercel.json already
  carries two daily crons — confirm the plan supports sub-daily schedules.)
