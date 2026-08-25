# Hot-Path Audit — 2026-08-24 (pre-affiliate-push)

Read-only audit of the four most-used code paths, run before the affiliate/rev-share
outreach push. Branch `clinchd/reply-path-attribution` @ `6d536d8`. No code modified.
Method: four parallel audit agents (DM pipeline, signup funnel, billing, background
machinery), each cross-checked against `audits/` and `docs/FEATURE-MAP.md` so stale
findings aren't re-reported. Rendered version: claude.ai artifact "Clinchd Hot-Path Audit".

Severity: **P0** = money lost / dead pipeline / free paid access · **P1** = user-visible
breakage under normal load · **P2** = edge case / scaling debt.

## Fix-first queue

1. **Un-pause outbound-first threads.** The Aug 16 takeover fix (`6d536d8`) makes every
   manually-typed cold DM opener create its conversation already paused
   (`human_took_over`), so the AI never replies to leads who answer. Check
   `conversationWasJustCreated` before `pauseForHumanTakeover`
   (`src/app/api/webhooks/instagram/route.js:657-676`), then un-pause affected prod rows:
   ```sql
   select id, created_at, origin, ai_pause_reason
   from conversations
   where ai_pause_reason = 'human_took_over' and created_at >= '2026-08-16';
   ```
2. **`allow_promotion_codes: true`** in `createCheckoutSession` (`src/lib/stripe.js:29-43`).
   Affiliate promo-code tracking is impossible without it.
3. **Unique index on `conversations(user_id, instagram_sender_id)`** + stop discarding
   lookup errors (`route.js:552-557, 859-865`). Prevents the duplicate-conversation
   runaway (every message from the lead spawns a new thread + greeting).
4. **Block checkout for already-subscribed users** (`create-checkout/route.js:63-66`) —
   currently creates a second concurrent subscription (double-billing).
5. **Gate comment-to-DM on subscription status** or clear `plan` on cancellation
   (`comment-to-dm-gate.js:11-16`, `webhooks/stripe/route.js:279-297`) — churned
   Unlimited users keep the feature + Anthropic spend free forever.
6. **Restrict RLS on `users` billing columns** (`001_initial_schema.sql:77-79`) — anyone
   can set `trial_ends_at` / `subscription_status` from the browser console.
7. **Step 5 "Go Live Now" must persist `onboarding_completed`**
   (`Step5GoLive.jsx:242-248`) — currently bounces new users back to step 2.
8. **Clear `onboarding_completed` cookie on sign-out** (`middleware.js:123-125`,
   `sidebar.jsx:226-230`) — shared/demo browsers skip onboarding into an empty dashboard.

## DM webhook pipeline

- **P0** Echo of a manually-typed opener pauses the newborn conversation; native-send
  context machinery (`NATIVE_SEND_PREFIX`, `match_and_claim_native_send`) unreachable.
  `route.js:657-676, 941-973`. Regression from `6d536d8`.
- **P0** No unique constraint on `conversations(user_id, instagram_sender_id)`; races
  create duplicates, then `maybeSingle()` errors are discarded → permanent runaway
  (new conversation + scripted greeting per message). `001_initial_schema.sql`,
  `route.js:552-557, 859-865`. `comment-dm-conversation.js:144-154` already handles a
  23505 that can't fire without the index.
- **P1** Drip processor sends before inserting its row (no `provider_message_id`);
  echo can win → nudge stored twice + AI self-pauses as `human_took_over`.
  `drip/processor.js:207-221`, `route.js:632-651`.
- **P1** Comment-to-DM same send-then-persist ordering; echo-created thread is paused and
  mislabeled `origin='native_send'`. `comment-dm-conversation.js:22-25`, `route.js:574-589`.
- **P1** Non-duplicate insert failure of the inbound row doesn't abort → AI replies
  against history missing the message it answers. `route.js:1022-1032, 1144`.
- **P1** Worst-case chain ≈67s vs `maxDuration=60` → killed after reply insert, before
  Meta send: lead ghosted, history poisoned. `route.js:33, 1215, 1654`,
  `dm-intent.js:379`, `instagram.js:209`.
- **P1** Attachment-only DMs dropped entirely (`route.js:120`); prompt rule 6 unreachable;
  a coach's attachment reply also never triggers the takeover pause.
- **P2** Redeliveries burn `increment_dm_count` before dedupe and overwrite
  `last_skip_reason` with `duplicate_message`. `route.js:996-1031`.
- **P2** After failed Meta send, hot-lead alerts + drip enqueue still run on the
  undelivered reply. `route.js:1756-1826`.
- **P2** Voice failure burns two 200/hr slots (voice reserve + text fallback reserve).
  `route.js:1553-1575, 1706-1730`.
- **P2** Transient processing errors permanently drop DMs (200 to Meta, no dead-letter).
  `route.js:64-67, 181-183`.

Verified correct: HMAC fail-closed + `timingSafeEqual` (dev bypass inert in prod);
message dedupe via partial unique index on `provider_message_id`; app-sent replies can't
trip the pause (insert-before-send + twin-stamp); speaker attribution fix from Aug 10
holds; multi-tenant isolation via unique IGBA index + abort-on-ambiguity; Anthropic
failures don't strand conversations; history bounded (20 rows); AES-256-GCM handling OK.

## Signup → onboarding → Instagram connect

- **P0** RLS "Users can update own profile" has no column restrictions — users can set
  their own `trial_ends_at`/`subscription_status` from devtools. `001_initial_schema.sql:77-79`.
- **P1** Step 5 "Go Live Now" routes to `/dashboard` without setting
  `onboarding_completed` → middleware bounces to onboarding step 2. `Step5GoLive.jsx:242-248`,
  `onboarding/page.js:216-221, 854`.
- **P1** `onboarding_completed` cookie browser-scoped, never cleared on sign-out or
  deletion; new signup on a used browser skips onboarding. `middleware.js:123-125`.
- **P1** `users.instagram_username` written on every connect but defined in no migration —
  any migrations-built environment fails all connects with 42703. `instagram/callback/route.js:205`.
- **P1** Auto-profile kickoff is an un-awaited fetch (no `waitUntil`); when frozen,
  `attempted_at` never stamps → 8s polling stall on every `/onboarding` load + import
  silently never happens. `instagram/callback/route.js:327-338`, `onboarding/page.js:227-255`.
- **P2** Consent denial mid-onboarding: redirect to `/settings?instagram=denied` is
  stripped by middleware → step 1 with no feedback. `callback/route.js:38-41`.
- **P2** Signup with existing email shows "Check your inbox" forever
  (`data.user.identities` never inspected). `signup/page.js:60-82`.
- **P2** `oauth_state` 600s expires during the Business-account conversion the error copy
  recommends; `invalid_state`/`auth_failed` always land on onboarding step 1 even for
  onboarded reconnectors.
- **P2** AI routes: unbounded payloads (`voice-chat` arbitrary message array), limiter
  fails open on RPC error, raw `error.message` in 500s. `rate-limit.js:31-35`.
- **P2** Concurrent callbacks can double-create Stripe customers (no lock, no unique
  index on `stripe_customer_id`).
- **P2** Account swap leaves old-account threads in the inbox (unmessageable IGSIDs).
- **P2** Minor: "Save & Exit" no handler; silent Google OAuth errors; disconnect keeps
  `instagram_username`; expired confirm link → `/login` with no message; "Remember me" unused.

Verified correct: trigger-vs-fallback insert race harmless (identical trials for Google
and email users); same-IGBA double-connect guarded (partial unique index +
`ig_already_connected`); `ig_switch_ack` value-bound and single-use; auto-profile route
internals sound; no middleware redirect loops; abandon-and-return re-hydrates.

## Billing & plans

Direct answers: `allow_promotion_codes` **not** enabled; DM AI **is** server-gated on
subscription status (`instagram/route.js:822-838`, `ai/reply/route.js:54-77`); comment-to-DM
is **not**.

- **BLOCKER** No `allow_promotion_codes` at checkout. `stripe.js:29-43`.
- **P0** Upgrade creates a second subscription; webhook last-event-wins flips `plan`
  between the two. `create-checkout/route.js:63-66`, `webhooks/stripe/route.js:187-254`.
- **P0** `customer.subscription.deleted` never resets `plan` → canceled Unlimited keeps
  comment-to-DM. `webhooks/stripe/route.js:279-297`.
- **P1** `trial_period_days: 7` on every checkout stacks a second trial (`stripe.js:36`).
- **P1** Late `invoice.payment_succeeded` resurrects canceled users to `active`
  permanently. `webhooks/stripe/route.js:143-156`.
- **P1** First failed invoice → `past_due` → all AI replies blocked during Stripe's
  retry window; no dunning; TrialExpiredGate renders nothing for `past_due`.
- **P1** Cap counts messages, not "1,500 conversations" — ~75 real conversations hits it.
  `instagram/route.js:995-1003`.
- **P1** Payment-link checkout without `client_reference_id`: charged, never activated,
  log-line-only alert. `webhooks/stripe/route.js:128-139`.
- **P2** No event-id dedup (retried checkout re-fires drip enrollment); zero-row updates
  silently no-op; stale customer id bricks checkout+portal with no self-heal; unknown
  price id silently maps to `base`; duplicate-customer race; founder bypass inconsistent
  (but doesn't leak to prod users).

Verified correct: webhook signature verification; event coverage complete;
cancel-at-period-end works; plan validated server-side at checkout; voice/drip routes
gate on plan+status; client-only TrialExpiredGate acceptable because DM money paths are
server-gated.

## Background machinery (crons, comment-to-DM, alerts)

No wrong-recipient path, no accidental public-posting path. The 2026-05-18 comment-to-DM
audit is fully stale (all items shipped).

- **P1** Anthropic error → lead silently vanishes: no classification row, no log row,
  200 to Meta, no retry. `classifier.js:340`, `comment-event.js:27-34`.
- **P1** Drip double-send: 50 claims / 5 workers / ~60s per nudge vs `maxDuration=60`;
  kill between send and `fired` update → 30-min reclaim re-sends (own nudge is
  `source='drip'`, passes the takeover check). `processor.js:104-118, 207-239`.
- **P1** `refresh-tokens` and `drip` crons accept `Bearer undefined` when `CRON_SECRET`
  unset (template-string compare); `drip-process` has the correct fail-closed timing-safe
  pattern to copy. `cron/refresh-tokens/route.js:37-39`, `cron/drip/route.js:10-12`.
- **P1** Webhook AI calls outside all rate limits (viral post = uncapped Anthropic spend);
  `sendPrivateReplyToComment` never calls `check_and_record_outbound` → comment DMs
  bypass the 200/hr Meta budget (the pattern that earned the prior 30-day restriction).
  `comment-event.js:306`.
- **P2** No self-comment filter (own pinned comments classified + dispatch attempted;
  Meta subcode 2018065 is the only backstop).
- **P2** Crash between classification insert and dispatch → redelivery skipped as
  "already classified", DM never sent. `comment-event.js:126-183, 306`.
- **P2** Cron scaling: sequential loops, no pagination (silent 1000-row cap), no
  `maxDuration` on refresh-tokens/drip.
- **P2** NULL `meta_token_expires_at` never refreshed or flagged. `refresh-tokens/route.js:111`.
- **P2** Reconnect email "sent" = "attempted"; failure swallowed, flag excludes user from
  future runs. `tokens/reconnect.js:84-99`.
- **P2** Assorted: `checkDmLimit` dead+broken (delete it); drip nudge records 200/hr slot
  after sending; onboarding emails have no unsubscribe (CAN-SPAM); `post-monitoring`
  matches `posts` by `ig_media_id` alone (cross-tenant FK foot-gun, harmless today);
  daily drip email one-duplicate edge.

Verified correct: `drip-process` cron auth; alert routes fail closed on missing
`ALERT_TOKEN`; comment dedup index prevents double-DMs; public replies genuinely
default-off; classifier fail-closed with review queue + kill switch + injection
escaping; drip fire-time re-verification (all 8 conditions, `FOR UPDATE SKIP LOCKED`);
IGSID match fallback-guarded; reconnect flagging fires once.
