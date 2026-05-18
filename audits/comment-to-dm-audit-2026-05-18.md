# Comment-to-DM Feature Audit

**Date:** 2026-05-18
**Auditor:** Claude Code

## Quick Summary

- A full classifier + decision-rule layer is built and persists results, but it runs only through the admin playground and never from a webhook.
- The Instagram webhook is subscribed to `messages,messaging_postbacks` only — there is no `comments` field subscription, and the webhook POST handler has no branch for the `comments` event type.
- DM-send (`sendInstagramMessage`) is wired only for replies inside existing message threads — there is no code path that sends a DM in response to a comment, and the comment-to-DM "simulation" log always writes `dispatched: false`.
- All four shadow tables (`post_monitoring_settings`, `dm_templates`, `comment_to_dm_log`, `comment_processing_queue`) exist with RLS, but **no coach-facing UI exists** to populate `post_monitoring_settings` or `dm_templates` — even the admin playground only seeds them indirectly.
- No tests, no webhook simulation script, no privacy-policy mention of comment data.

## Shadow Mode State

**(A) Classifier-only — webhook not subscribed to comments field, no DM-send wiring.**

Supporting evidence:
- `src/app/api/auth/instagram/callback/route.js:150` and `src/lib/instagram.js:157` subscribe Meta to `messages,messaging_postbacks` — `comments` is not in either string.
- `src/app/api/webhooks/instagram/route.js:30-44` only branches on `body.object === "instagram"` and then iterates `entry.messaging`. It never inspects `entry.changes`, which is where Meta delivers `field: "comments"` events. A comment webhook payload would silently fall through.
- The only call to `classifyComment()` is in `src/app/api/admin/classify/route.js:142`, which is gated by `isIntentClassifierEnabled(user.email)` (founder email only) at line 40.
- The only writer to `comment_to_dm_log` (`src/app/api/admin/classify/route.js:223-231`) hard-codes `dispatched: false`. No production caller calls `sendInstagramMessage` with a `recipient.comment_id` recipient.

This is stronger than "founder-only DM-send" — even the founder cannot actually send a comment-triggered DM from this codebase. It is classifier + decision-rule simulation only.

## Section 1: Webhook Subscription State

- Subscription strings:
  - `src/app/api/auth/instagram/callback/route.js:150` — `subscribed_fields: "messages,messaging_postbacks"` (the IG connect flow's POST to `/{igbaId}/subscribed_apps`).
  - `src/lib/instagram.js:157` — `subscribed_fields=messages,messaging_postbacks` in the helper `subscribePageToWebhooks` (Facebook Page variant).
  - Neither string contains `comments`. There is no second call adding the `comments` field after connect.
- Webhook handler: `src/app/api/webhooks/instagram/route.js`.
  - GET verification at lines 13-26 (`INSTAGRAM_WEBHOOK_VERIFY_TOKEN`).
  - POST entry at lines 30-44 dispatches only `body.object === "instagram"` into `handleMetaWebhook`.
  - `handleMetaWebhook` (line 48) iterates `entry.messaging` only (line 60). There is **no branch** for `entry.changes` / `field === "comments"`. Comment payloads from Meta would land at the POST, fall past the `messaging` loop, and 200-OK without being processed.
- HMAC verification: yes. `src/app/api/webhooks/instagram/route.js:50-55` calls `verifyWebhookSignature` (implemented at `src/lib/instagram.js:236-249` using `crypto.createHmac("sha256", process.env.INSTAGRAM_APP_SECRET)` with a length-checked constant-time compare). If `INSTAGRAM_APP_SECRET` is unset the handler logs a warning and accepts unverified bodies (line 51-52) — a soft-fail mode that should be hardened before production.
- Comment-event handler behavior: not present. There is no early-return / log-only / processing branch — the route simply has no awareness of comment events.

## Section 2: Comment Classifier

- File: `src/lib/classifier.js`. Exported function: `classifyComment` (line 263). Exports `CLASSIFIER_MODEL` and `CLASSIFIER_VERSION` (lines 3-4).
- Model: `claude-haiku-4-5-20251001` (matches expected). Hard-coded at `src/lib/classifier.js:3`. The webhook's separate `classifyIncomingMessage` (different feature) also defaults to the same Haiku id via env override in `src/lib/anthropic.js:12-14`.
- Structured intent categories (enum at `src/lib/classifier.js:6-14`):
  1. `HIGH_INTENT`
  2. `ENGAGED_NOT_BUYING`
  3. `CRITICAL_NEGATIVE`
  4. `LOW_SIGNAL`
  5. `NOT_A_LEAD`
  6. `SPAM`
  7. `UNCERTAIN`
  Returned via the forced tool call `record_comment_intent` with `{class, confidence, language, reasoning, signals[]}`.
- Env-var kill switch: **no direct model kill switch.** Adjacent flags:
  - `VISION_ENABLED` (`src/lib/classifier.js:229-230`) — gates optional image-input arm.
  - `INTENT_CLASSIFIER_SHADOW_MODE` (constant `true` at `src/lib/featureFlags.js:10`) and `ADMIN_EMAIL` — gate access, not model invocation.
  - There is no `CLASSIFIER_ENABLED` / `COMMENT_CLASSIFIER_KILL` env var. Disabling the classifier today requires flipping `INTENT_CLASSIFIER_SHADOW_MODE` to `false` and redeploying.
- Caller surface: the only call site is `src/app/api/admin/classify/route.js:142`. The Instagram webhook does not import `classifier.js` — confirmed by grep across `src/app/api/webhooks/instagram/`.

## Section 3: Admin/Playground UI

- Admin route: `src/app/admin/classifier/page.jsx` (playground entry, line 13-54) and `src/app/admin/classifier/ClassifierPlayground.jsx` (client form). Sibling routes: `src/app/admin/classifier/history/` and `src/app/admin/comment-queue/page.jsx`.
- Founder bypass: scoped to `isIntentClassifierEnabled(user.email)` (`src/lib/featureFlags.js:14-18`) which compares lowercase against `ADMIN_EMAIL` env (defaults to `dominickjerell@gmail.com`). This is its own gate, **separate from `isFounder()`** in `src/lib/founder.js`. The classifier API and the playground both call `isIntentClassifierEnabled`. `isFounder()` (and `FOUNDER_EMAILS`) is used elsewhere for trial-gate bypass (`src/components/app/TrialExpiredGate.jsx:7,53,75`) and is not referenced by anything comment-related.
- What the gate covers: classifier playground (`/admin/classifier`), classifier history (`/admin/classifier/history`), the comment queue viewer (`/admin/comment-queue`), the `POST /api/admin/classify` route, and the `POST /api/admin/classify/feedback` route. The gate does **not** wire a DM-send path — it gates a synthetic test surface that writes to `comment_to_dm_log` with `dispatched: false`.
- Visibility for non-founder users: zero. Non-founders calling the gated routes get a 404 (`page.jsx` calls `notFound()` at line 24; the API routes return `{error: "Not found"}` with status 404 at `src/app/api/admin/classify/route.js:41` and `feedback/route.js:25`). No public-facing comment-to-DM UI is rendered to paid users.

## Section 4: Coach-Facing Configuration UI

- Per-post selection: **none.** No page lets a coach pick which Instagram posts trigger comment-to-DM. The `post_monitoring_settings` table exists but has no API or UI to insert/update rows for end users. The `POST /api/admin/classify` route reads `post_monitoring_settings` (`src/app/api/admin/classify/route.js:198-202`) but never writes to it, and there is no `POST /api/settings/post-monitoring` or similar.
- Keyword triggers: **not implemented.** The flow is classifier-based intent, not keyword matching. `decideAction()` (`src/lib/comment-trigger-rules.js:74-142`) routes on `class` plus the per-class action map; there is no keyword input anywhere in the comment pipeline.
- Posts fetch from IG Graph: the `/me/media` call exists at `src/lib/instagram/fetch-profile-content.js:104-108` but it is consumed by the voice-profile auto-import flow (captions and recent media) — not by any post-picker UI. There is no comment-to-DM post-picker.
- Visibility: hidden entirely. No page (founder or paid) currently lists a coach's posts in a "select which trigger comment-to-DM" surface.

## Section 5: DM-Send Path

Traced from "comment received" to "DM sent". Numbered steps reflect what is **wired**; the path stops where noted.

1. Meta sends a webhook POST with `entry.changes[].field === "comments"` to `/api/webhooks/instagram` (`src/app/api/webhooks/instagram/route.js:30`).
2. Handler verifies HMAC (line 50-55) — this would pass.
3. Handler enters `handleMetaWebhook` (line 48). The function iterates `entry.messaging` only (line 60). **It does NOT inspect `entry.changes`.** Comment payloads exit the function unhandled.
4. *(Would be: parse the change, look up owner by recipient/IGBA, run `classifyComment`, run `decideAction`, queue, send DM)* — not implemented.
5. *(Would be: when `decideAction` returns `action === "dm"`, send via Graph API)*. The only DM-send call sites are:
   - `src/app/api/webhooks/instagram/route.js:659` — sends an AI reply inside an existing message thread (in response to an inbound DM).
   - `src/app/api/ai/reply/route.js:130` — dashboard "regenerate reply" path.
   - `src/app/api/outreach/start/route.js:183` — cold outreach (founder-only path).
   None of these is connected to a comment trigger.
6. Stop point: between steps 3 and 4. No code path observes a comment event, so steps 4+ never run. The comment-to-DM simulation that DOES exist (`/api/admin/classify`) writes `comment_to_dm_log` with `dispatched: false` (`src/app/api/admin/classify/route.js:223-231`) and never calls `sendInstagramMessage`.

Comment-reply Graph API endpoint distinction: `sendInstagramMessage` (`src/lib/instagram.js:179-201`) targets `/{igAccountId}/messages` with `recipient: { id: <IGSID> }`. For a comment-triggered private reply, Meta expects `recipient: { comment_id: <comment_id> }` posted to the same `/me/messages` endpoint. The current helper hard-codes `recipient: { id: recipientId }` (line 188). There is **no** comment-id variant in the codebase — adding one is a required gap.

## Section 6: Database Schema

Tables (migrations live in `supabase/migrations/`):

- **`comment_classifications`** — `supabase/migrations/20260420120000_intent_classifier_shadow.sql:55-80`. Key columns: `creator_id`, `post_id`, `bundle_id`, `ig_comment_id` (nullable in shadow mode), `ig_commenter_username`, `comment_text`, `class`, `confidence`, `language`, `reasoning`, `signals[]`, `model`, `classifier_version`, token + latency telemetry, `classified_at`. Dedup index added in the later migration: `idx_classifications_dedup` on `(creator_id, ig_comment_id) WHERE ig_comment_id IS NOT NULL` (`20260514120000_comment_to_dm_buildout.sql:173-175`).
- **`comment_to_dm_log`** — `20260514120000_comment_to_dm_buildout.sql:102-115`. Audit row per simulated/real decision. Always `dispatched: false` today.
- **`comment_processing_queue`** — `20260514120000_comment_to_dm_buildout.sql:137-151`. Schema only; no worker reads it. `status`, `attempts`, `error_message`, `processed_at` columns prepared for an async pipeline.
- Trigger config tables:
  - **`post_monitoring_settings`** — `20260514120000_comment_to_dm_buildout.sql:35-46`. `enabled BOOL`, `actions_per_class JSONB`, unique on `(creator_id, post_id)`. No coach-facing writer.
  - **`dm_templates`** — `20260514120000_comment_to_dm_buildout.sql:69-79`. Per-creator per-class template body. No coach-facing writer.
- Supporting tables: `creator_offers`, `posts`, `post_context_bundles`, `classifier_feedback` — all in `20260420120000_intent_classifier_shadow.sql:9-93`.
- RLS: yes, on all seven tables. Policies in `20260420120000_intent_classifier_shadow.sql:96-174` and `20260514120000_comment_to_dm_buildout.sql:48-167`, all scoped `auth.uid() = creator_id` (the bundles table joins through `posts.creator_id`).
- Retention / cleanup: **none for comment tables.** The only retention job is `purge_closed_conversation_data` in `supabase/migrations/016_retention_job.sql:14-40`, which targets the `messages` and `conversations` tables for closed conversations after 7 days. No cron, no edge function, no script deletes from `comment_classifications`, `comment_to_dm_log`, or `comment_processing_queue`. This is a Meta-submission gap — comment data must have a documented retention window.

## Section 7: Feature Flags

- `INTENT_CLASSIFIER_SHADOW_MODE` — `src/lib/featureFlags.js:10`. Hard-coded `true`. Gates the playground + classify routes.
- `ADMIN_EMAIL` — `src/lib/featureFlags.js:12`. Env-driven, falls back to `dominickjerell@gmail.com`. Single email allowed through `isIntentClassifierEnabled`.
- `VISION_ENABLED` — `src/lib/classifier.js:229-230` and `src/app/admin/classifier/page.jsx:45-46`. Default off. Controls optional image input to the classifier.
- `NEXT_PUBLIC_COMMENT_TO_DM_VISIBLE` — public flag that adds a comment-to-DM line item to marketing/billing UI:
  - `src/app/(dashboard)/billing/page.js:65`
  - `src/components/landing/pricing.jsx:27`
  - `src/components/landing/features.jsx:58`
  Affects copy only; no functional gating.
- `FOUNDER_EMAILS` — `src/lib/founder.js:10`. Default `dominickjerell@gmail.com`. Used by `TrialExpiredGate` (trial bypass) only — not by the comment pipeline.
- Production values: `env.local.example` does not include any of `VISION_ENABLED`, `ADMIN_EMAIL`, `NEXT_PUBLIC_COMMENT_TO_DM_VISIBLE`, or `FOUNDER_EMAILS`. Live values unknown — needs Vercel dashboard check.
- `hasCommentToDM(plan)` (`src/lib/plans.js:52-54`) returns `true` only for `plan === "unlimited"`. Currently only referenced from `// TODO` comments inside the admin classify routes — not enforced anywhere yet.

## Section 8: Privacy Policy

- File: `src/app/(legal)/privacy/page.js`.
- Comment data: **not mentioned.** The Instagram-data section (`src/app/(legal)/privacy/page.js:27-46`) lists "Instagram account ID, username, profile information, and the content of direct messages." There is no language covering Instagram comment text, comment IDs, or commenter usernames. Section 5 on retention (lines 99-107) only describes message retention (7 days for closed conversations).
- Data deletion: addressed at a high level. Section 5 (line 106): "If you delete your account, we will remove your personal data within 30 days." Section 7 (lines 116-124) lists data-subject rights. The in-app deletion entry point is `/api/user/delete` (`src/app/api/user/delete/route.js`, referenced from `src/app/(dashboard)/settings/page.js:147`). There is **no public data-deletion-instructions page** at a stable URL (e.g., `/data-deletion`) — Meta requires a public URL for this. Section 8 also doesn't describe a comment-data deletion path.

## Section 9: Tests

- Test files: `find` for `*.test.js` returned nothing in the repo. There is no test runner configured.
- Scripts directory: does not exist at `scripts/`. `find -name "test-*.mjs"` and `-name "*.mjs"` (excluding `node_modules`/`.next`) return only `postcss.config.mjs` and `eslint.config.mjs`.
- Comment-webhook simulator: **none.** No analogue of `scripts/test-calendly-webhook.mjs` exists for Instagram comments (or for Instagram messaging — that webhook also lacks a local simulator).
- Manual verification only — `docs/intent-classifier-shadow-mode.md:34-61` documents a manual run-through via the admin playground.

## Gap List for Meta Submission

1. **Subscribe to the `comments` field on connect.** Update `subscribed_fields` at `src/app/api/auth/instagram/callback/route.js:150` and `src/lib/instagram.js:157` to `messages,messaging_postbacks,comments`. Add a backfill path that re-subscribes already-connected accounts (one-off script or on next webhook receive).
2. **Add a `comments` branch to the webhook POST handler.** In `src/app/api/webhooks/instagram/route.js`, handle `entry.changes` where `field === "comments"`: extract `comment_id`, `media_id`, `from.id`, `from.username`, `text`; look up owner by IGBA; persist to `comment_classifications` (use `ig_comment_id` to hit the dedup unique index).
3. **Wire `classifyComment` + `decideAction` into the webhook.** Call `classifyComment` (or push to `comment_processing_queue` and process asynchronously) and route through `decideAction` with the coach's `post_monitoring_settings` and `dm_templates` rows.
4. **Add the comment-triggered DM-send path.** Either extend `sendInstagramMessage` in `src/lib/instagram.js:179` or add a new helper (`sendPrivateReplyToComment`) that POSTs to `/{igAccountId}/messages` with `recipient: { comment_id }`. Flip `comment_to_dm_log.dispatched` to `true` and store the resulting message id when send succeeds.
5. **Build a coach-facing trigger config page.** New page (e.g., `src/app/(dashboard)/comment-triggers/page.jsx`) that lists the coach's recent IG posts via `/me/media`, lets them toggle `post_monitoring_settings.enabled` per post, and edits `actions_per_class`. Add `POST /api/settings/post-monitoring`.
6. **Build a coach-facing DM template editor.** New page (e.g., `src/app/(dashboard)/dm-templates/page.jsx`) and `POST /api/settings/dm-templates` to populate `dm_templates` rows. Must exist for `decideAction` to ever return `action: "dm"` (it falls back to `queue_review` when no template — `src/lib/comment-trigger-rules.js:115-125`).
7. **Replace the founder-email gate with the plan gate.** Resolve the four `// TODO(comment-to-DM gate)` comments at `src/app/admin/classifier/page.jsx:27-32`, `src/app/api/admin/classify/route.js:44-50`, `src/app/api/admin/classify/feedback/route.js:28-33`, and the analogous spots in the new endpoints from items 5 and 6. Use `hasCommentToDM(profile.plan)` from `src/lib/plans.js:52`.
8. **Add comment-data sections to the privacy policy.** Edit `src/app/(legal)/privacy/page.js` Section 3 (Instagram Data) to disclose comment text, comment IDs, commenter usernames, and the post they reference. Edit Section 5 (Data Retention) to state a specific retention window for comment data (e.g., "comment metadata retained 90 days, content purged on commenter request"). Tie it to a real DB job (item 9).
9. **Add a retention/cleanup job for comment tables.** New migration alongside `016_retention_job.sql` that purges `comment_classifications`, `comment_to_dm_log`, and `comment_processing_queue` rows older than the documented window. Wire a pg_cron entry the same way `purge-closed-conversation-data` is scheduled.
10. **Publish a public data-deletion-instructions URL.** Meta requires this for app review. Add `src/app/(legal)/data-deletion/page.js` describing the in-app `/settings → Delete account` flow plus an out-of-band email route, and link it from the app dashboard footer + Meta App Dashboard.
11. **Harden the HMAC fail-open at `src/app/api/webhooks/instagram/route.js:51-52`.** When `INSTAGRAM_APP_SECRET` is missing, return 503 instead of accepting unverified requests. Currently a misconfigured deploy accepts spoofed comment payloads.
12. **Add a real env-var kill switch for the classifier.** New `COMMENT_CLASSIFIER_ENABLED` env consumed by `classifyComment` (or a wrapper) and checked at the webhook branch from item 2. Lets you flip the feature off in production without a redeploy if Anthropic spikes or Meta limits change.
13. **Write a comment-webhook simulation script.** New `scripts/test-instagram-comment-webhook.mjs` mirroring `scripts/test-calendly-webhook.mjs` — POSTs a signed `entry.changes[field=comments]` payload to `/api/webhooks/instagram` for local + preview QA. Doubles as the screencast prep tool for the Meta App Review submission.
14. **Update `subscribed_fields` for already-connected accounts.** One-off `npm` script or migration that re-issues `subscribed_apps` for every `users` row with a non-null `instagram_business_account_id` after item 1 ships.
15. **Decide and document `recipient.comment_id` policy window.** Meta's private-reply window is short (currently 7 days after the comment). Document this constraint in `decideAction` and the admin queue so stale items fail clearly rather than triggering Graph errors.

## Estimated Time to Submission-Ready

| Category | Item refs | Hours |
| --- | --- | --- |
| Code work — webhook + DM-send wiring | 1, 2, 3, 4, 11, 12, 14, 15 | 16–22 |
| Code work — coach UIs | 5, 6, 7 | 10–14 |
| Schema + retention | 9 | 1–2 |
| Copy work — privacy policy + deletion page | 8, 10 | 2–3 |
| Recording — screencast of the full comment → classify → DM flow for App Review | (review submission) | 2–3 |
| Testing — webhook simulator + manual run-through | 13 | 3–4 |
| **Total** |  | **34–48 hours** |

This assumes one engineer, no surprises in Meta App Review review-loops, and that the privacy-policy / data-deletion copy doesn't need legal review.
