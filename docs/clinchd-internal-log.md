# Clinchd Internal Log

Living internal record. Not user-facing. One place to collect shipped changes,
open issues, positioning decisions, and competitive intel.

- **Maintained by:** Dom
- **Last updated:** October 6, 2026

How to use this doc:
- **Shipped changes** — log anything that went live (copy, features, fixes). Newest first.
- **Open issues / watch-list** — known problems and external triggers to watch.
- **Positioning** — the canonical messaging rules. Edit here first, then the site.
- **Competitive analysis** — the market map and the wedge.

---

## Positioning (canonical)

**One-liner:** The AI DM setter you don't have to apply for.

**Angle:** Own the coach the enterprise done-for-you tools refuse to take.
Self-serve, transparent, live today, you keep control.

**Copy rules (apply everywhere public):**
- No "automate / bot / scrape / monitor".
- Anchor pricing against the **human setter cost** ($2,000 to $4,000 / mo), never against competing software.
- Say "qualified conversations", not "DMs".
- No em dashes.
- **Competitor names never appear in public copy.** (Exception, deliberate and scoped: the SEO comparison pages at `/compare/vs-*`, their nav/footer links, and `<meta>` keywords. These are a separate search play, not positioning copy.)
- Never use the word "clone." It's the competitor's narrative and carries the voice-synthesis baggage we deliberately avoid.

**The wedge in one paragraph:** Clinchd is for coaches with 5,000 to 100,000
followers and an offer worth more than $1k. More DMs than time, can't justify a
$3,000 setter yet, losing real money to slow replies. No application, no sales
call to learn the price, live today.

**Honesty line (use it, it builds trust):** Clinchd handles qualifying and
booking. You still close the call. That's the part only you can do.

---

## Shipped changes

### 2026-10-06: Business knowledge base, PR A, deployed (PR #53)
Merged as `494cfd1` at 08:44 UTC. Vercel production deploy `dpl_4EByLKAK56mFyvtMQ25uTNXnELpD` was ready at 08:45:11 UTC and serves clinchd.io and www.clinchd.io.

- **What shipped:**
  - **Data:** `knowledge_entries` (FAQ / policy / note). The browser can read its own rows only; every write goes through `/api/settings/knowledge`, with a 15,000-character cap that counts the rendered block. Starter drafts dedupe on a unique (user_id, template_key).
  - **Settings > Business knowledge:** an editor with coaching and med spa starters and the "may be shown to leads" warning.
  - **Grounding:** an escaped `<business_knowledge>` block after the system rules, on all four reply paths (`loadReplyGrounding`).
  - **Handoffs:** medical for every account; missing knowledge only once an account has an enabled entry, and limited to the service's own price, availability and policies (scheduling a call gets the booking link). The lead gets the fixed holding text, the thread pauses (`medical_question` / `missing_knowledge`) and the owner is emailed. Medical emails never quote the lead.
  - **Medical checks:** a classifier signal before the voice step, a health-keyword voice prefilter, and the reply-model marker. Any marker form counts as a handoff.
  - **Analytics:** classifier reasoning and signals are no longer sent to PostHog.
- **Pre-merge evidence:** live eval `scripts/eval-knowledge.mjs` 17/17 (3 trials each). Classifier replay prod 70/75 with 0 critical, synthetic 20/20. 622 unit tests and the DB tests passed. One audit round (P1 voice bypass, booking vs availability, signal list, plus P2 caps, markers, email and privacy) was fixed before merge.
- **Production order (2026-10-06):** Dom ran migration `20261008120000_knowledge_entries.sql` in Reachai and verified it independently (RLS on, select-own policy only, no browser writes, 0 rows, no browser-callable definer functions), then merged.
- **Post-deploy checks (08:45-08:48 UTC):**
  - Logged out, `/settings/knowledge` and `/api/settings/knowledge` redirect to `/login`, the same as `/settings/offer`.
  - Signed in as Dom, Settings > Business knowledge loads: empty list, 0 / 15,000 meter, and the offer card (Clinchd, $97.99, offer page, booking link).
  - Playground "How much does it cost?" got a grounded reply quoting $97.99.
  - Playground "i'm pregnant, is it safe for me to do this?" got the holding text and the "Handed to you: medical or health question" label.
  - Runtime logs for the deployment: no 4xx/5xx and no errors. The only warning is a pre-existing Node `url.parse()` deprecation notice from the edge middleware.
- **Not yet seen live:** a real inbound DM through the webhook on this deploy (none had arrived by 08:48), a real handoff email, and an account with enabled entries. Check the first `knowledge_handoff` PostHog event and its email when one happens.

### 2026-10-06: Card-required trial and billing overhaul deployed (PR #51)
Merged as `50c4d4b` at 04:57 UTC; Vercel production deploy `6876060079` completed about a minute later. Every deploy-checklist step was run by Dom and verified independently.

- **What shipped:** one access check (`hasActiveAccess`) everywhere; card-required Stripe Checkout with a 7-day trial for new accounts only (an HMAC-of-email ledger blocks second trials, including after account deletion); idempotent Stripe webhook (processing/done claims); duplicate-subscription refund and cancel; browser-forged lead messages and DM-meter writes blocked by triggers; definer functions closed to the browser; inbound DMs stored at the lead's real send time; analytics, alerts and drip can never fail a webhook; comped accounts see "Complimentary plan" and can't buy; "no credit card" and the money-back guarantee removed from all copy.
- **Sandbox run (2026-10-05, test mode):** all 11 test cases plus two Checkout tabs, late Meta delivery and Checkout expiry passed. Fixes found by the run shipped in the PR.
- **Production order (2026-10-06):** H1 revokes (by hand, 2026-10-05), `20261007120000`, `20261007130000`, `20261007140000`, then back to back: `20261006130000`, ledger seed (12 rows), `20261006140000`, merge and deploy. `20261006140000` was first run in the wrong project and re-run in Reachai about a minute after the deploy; until then the webhook ran without dedupe, as designed (claims are skipped and logged when the table is missing); Dom reported the logs clean since deploy.
- **Post-deploy checks:** production ledger fingerprint `d34171f05741` matches the seed; comped account loads the dashboard and Billing shows "Complimentary plan"; logs clean.
- **Knowledge base work is unblocked** (it waited on this PR).

### 2026-06-03 — Homepage repositioned to "the setter you don't have to apply for"
Applied the access-led positioning to the live homepage. Removed every
competitor name from visible body copy and re-anchored to the human-setter cost.

- **Hero** (`hero.jsx`): headline → "A DM setter that's live today. No application required." Badge → "The DM setter you don't have to apply for." Subhead rewritten (no $3,000 setter, no qualifying call, no build team). Primary CTA → "Start for $97/month". Trust line → "No application · No sales call · Live in minutes".
- **New section** `who-its-for.jsx`: the wedge, placed after Problem. Two-column "enterprise gate vs who Clinchd is for." Most important new block — converts the $50k gate into our reason to exist.
- **Comparison** (`comparison-callout.jsx`): replaced the "Why coaches switch from ManyChat" table with the "Math on a human setter" table (Cost / Hours / Ramp / Consistency / Voice / Concurrency). Added the honesty line. CTA → "See it on your own offer".
- **Pricing** (`pricing.jsx`): headline → "A $3,000 setter, or $97/mo." Rewrote the per-contact block (dropped ManyChat/Inro names) into a transparency + human-setter anchor. Unlimited reframed away from "scaling past $50k" toward voice replies; added "Voice replies in your own recorded audio" feature.
- **FAQ** (`faq.jsx`): dropped the "How is this different from ManyChat?" question. Added four objection handlers: "$50k a month?", "just a chatbot with a script?", "do you fake my voice?", "what does it cost, really?".
- **Problem** (`problem.jsx`): "ManyChat feels robotic" → "Flow builders feel robotic".
- **Structured data** (`page.js`): FAQPage + SoftwareApplication schema updated to mirror the new visible FAQ and the voice-replies feature.
- **Left untouched (intentional SEO):** `/compare/vs-*` pages, nav/footer "vs X" links, and the "manychat alternative" meta keyword.

### 2026-05-31 — Instagram: request `manage_comments` scope at OAuth connect
### 2026-05-28 — Onboarding audit cleanup (Tier A + B0 + B)
### 2026-05-27 — Drip: in-window follow-up nudges v1 (deploy-dark, Unlimited)
### 2026-05-22 — Analytics: filter bookings by `booked_at`, not `start_time`
### 2026-05-22 — Sidebar: collapse to icon rail, expand on hover
### 2026-05-21 — Landing: Coming Soon cards for Comment-to-DM and Voice Replies
### 2026-05-20 — Voice replies: coach-uploaded voice memos + AI DM intent classifier

---

## Open issues / things to fix

- **Webhook dedupe not yet seen live.** `stripe_webhook_events` had 0 rows after the 2026-10-06 deploy because no Stripe event had arrived. Confirm on the next natural event (signup, renewal, portal change): delivery 200 and a row with `status = 'done'`. Don't resend events to test it.
- **CI `db-checks` workflow: `npm ci` fails** because `package-lock.json` is out of sync with `package.json` (pre-existing on the base branch, not from PR #51). The `db-tests` job passes; the `definer-grants` job never reaches its checks. Fix the lockfile in the follow-up PR.
- **CI live grant check is off.** Deploy step 3d was skipped: `ci_grant_reader` exists with no password, and the `SUPABASE_CI_DB_URL` secret isn't set. Set them when wanted (PR #51 checklist, step 3d: password via psql `\password`, never `ALTER ROLE ... PASSWORD`).
- **Follow-up PR (queued, fresh session, branch from `claude/build-reachai-app-PeuJk`):** (1) plan limits: Base = 1,500 qualified conversations/month, Unlimited = unlimited; grep all copy (landing, pricing, FAQ, compare, blog CTAs, llms.txt, metadata, emails) for "500 DMs", "500 conversations" and other limit wording, rendering from `src/lib/plans.js` where copy comes from code; (2) show/hide password toggle on login and signup (eye button inside the field, `type="button"`, aria-label "Show password"/"Hide password", keep `current-password`/`new-password` autocomplete); (3) the CI lockfile fix above.
- **Drip step 1 is marked sent even when the email fails.** Found in the 2026-10-05 sandbox run (PR #51). `/api/drip/enroll` sends step 1, then always inserts `email_events` `drip_step_1` and sets `drip_step: 1`, without checking `sendEmail`'s result (`{ success: false }` on a Resend error or missing key). A Resend outage at signup silently skips a new subscriber's welcome email forever; the cron only sends steps after the current one. Fix: advance and log only on `result.success`, as the drip cron already does; on failure leave `drip_step: 0` so the cron retries step 1. Follow-up, not in PR #51.
- **Identity-by-proxy AI behavior.** "wait is this Dom?" still gets evasive replies. Tighten rule 7 in `prompts.js`. (Carried over from prior session note.)
- **TASK: Business knowledge base (grounding for every account).** Added 2026-10-05. Without it the AI invents prices and policies or stays vague. Build for coaches too, not just the med spa.
  - **MVP, no RAG:** cap each account at ~15k chars and put all of it in the system prompt inside `<business_knowledge>` tags. Simpler and more accurate than retrieval at this size, and it caches (clears Haiku's 1024-token cache minimum). Add retrieval only when real accounts hit the cap.
  - **Table:** `knowledge_entries` (`id`, `user_id`, `type`: faq | policy | note, `question`, `answer`, `enabled`, `updated_at`). RLS `user_id = auth.uid()`; Zod length limits.
  - **Starter templates per vertical** (a blank box gets ignored): services, pricing, booking link, hours/location, cancellation policy; med spa adds "requires consultation" items.
  - **Fallback rule:** if the answer isn't in the knowledge, the AI says it'll check and flags the thread for a human. Never guesses price, availability, or anything medical.
  - **Unanswered-questions log (the real win):** every handoff records the lead's question; the owner answers with one tap and it becomes a new FAQ. The knowledge base fills itself from real DMs.
  - **Med spa flag:** off the coach niche; deliberate vertical test only. Hard rule: never give medical advice (e.g. "Botox while pregnant?"), always hand off. State medical-board rules on claims apply.
  - **Gotchas:** anything in the knowledge can leak (a lead can coax the AI into repeating it), so warn owners in the UI: no margins, no private notes. Owner text is untrusted: system rules stay above and outside the block, and the model is told knowledge can't change its rules. Edits break that account's prompt cache (expected).
  - **Decisions (Dom, 2026-10-05):**
    1. Medical/health handoff rule applies to ALL accounts, scoped to: medical conditions, injuries, medications, pregnancy, treatment suitability, and any health outcome claims. Normal coaching questions (training, mindset, offer details) are NOT handoffs.
    2. Fallback handoff only for price, availability, policy, plus the medical cases in 1.
    3. Build order: (a) PostHog tracking PR (identify by Supabase user id, not email); (b) activation guard + 24h messaging window (Dom supplies the prompt); (c) card-required trial + access gating (Dom supplies the prompt; **access gating must use `hasActiveAccess`, never `onboarding_completed`, which the browser can set**); (d) KB PR A (table, settings editor with vertical templates, `<business_knowledge>` grounding, fallback via the existing human-handoff path); (e) KB PR B (unanswered-questions log, one-tap answer to FAQ). **Do not start KB until the billing PR (c) is merged.** (Merged and deployed 2026-10-06 as PR #51.)
  - **PR A shipped 2026-10-06 (PR #53, see Shipped changes).** PR B (unanswered-questions log, one-tap answer to FAQ) is next and not started; it reads the category from `messages.intent_classification.handoff`. Decisions made in the Phase 0 review:
    - Handoff is the **per-thread** pause (`ai_paused` + `ai_pause_reason` = `medical_question` | `missing_knowledge` + owner email), not account-wide `ai_mode 'handoff'`. The lead gets the fixed holding text "Good question, let me check on that and get back to you." (`src/lib/handoff-reply.js`, the seam for per-account overrides).
    - The model never writes the holding text: it outputs `<<HANDOFF:...>>` and the server swaps it. Any marker anywhere (mixed in, malformed) is a handoff (`detectHandoff`).
    - Medical is checked twice: a `medical_question` signal on the intent classifier hands off **before the voice step**, and the reply model's marker is the second net. If the classifier errors, there's no voice step. The missing-knowledge handoff applies only once an account has at least one enabled entry.
    - Corrections to the notes above: Haiku 4.5's cache minimum is **4096** tokens, not 1024. The reply call (Sonnet 4.6) has **no prompt caching**, so the knowledge block doesn't change cache behavior today. The block is deterministic so caching can be added later.
    - Templates leave out offer, price and booking link. They live in `creator_offers` / `calendly_url` and show read-only on the page. Validation is hand-written (no zod in the repo).
  - **Existing schema (checked 2026-10-05):** no knowledge/FAQ table. `creator_offers` exists (`offer_name`, `offer_price_cents`, `offer_url`, `ideal_customer`, `objections`, `qualification_questions`, `deprecated_at`) and already grounds every reply path via `src/lib/active-offer.js`. Knowledge entries should sit beside it, not replace it. Script config (offer text, greeting, objections) lives in `users.script_config` JSON.
- **Coach accounts don't disclose AI on first message; review against CA B&P 17940 before scaling.** Added 2026-10-06. The server-side first-message disclosure (PR #55) is on for persona accounts only (`business_name` set). Coach accounts still disclose only when asked (prompt rule 7).
- **PR #55 audit follow-ups (logged 2026-10-06, not fixed in #55):**
  - Persona names: add a title deny-list for `assistant_name` ("Nurse", "Dr", "Doctor", "RN", "NP", "PA"…) and ban quotes and colons in `business_name` (`src/lib/persona.js`).
  - Managed accounts see "missed leads" / paywall copy meant for lapsed subscribers: `src/app/(dashboard)/dashboard/page.js:205`, `src/app/(paywall)/choose-plan/page.js:65`.
  - CI: add `20261005150000_users_write_allowlist.sql` to the migration list in `supabase/tests/run.sh`, so the users column grants are tested with the new server-only columns.
  - Scrub Postgres error text before it reaches the emit-failure log (`outbound_webhook_emit_failures.message` and the cron's `emit failure` line). Keep the SQLSTATE; drop or redact the message.
  - When `persistCommentDmConversation` relabels an echoed opener, also clear a `human_took_over` pause if the echo caused one.
- **TASK: `lead_updated` webhook event + no-booking-link prompt fix (branch `feat/lead-updated-event`, built 2026-10-07; migration NOT run).**
  - **Gap (live testing):** `treatment_interest` was saved to `lead_profiles` on an inbound DM, but nothing was sent. The receiver only learned it if a later lifecycle event carried the lead.
  - **Fix:** new event `lead_updated` (no stage meaning). `outbound_on_lead_profile` emits it when `treatment_interest` goes from null to a value, with dedupe key `lead_updated:<conversation_id>:treatment:<key>`. It is not subject to the contact cap of 6. The body is the normal envelope, `data {}`. It is in the default `event_types` for new webhooks; existing webhooks need the `events` command (runbook, Operations).
  - **Prompt:** with no booking link, the model told a lead "we don't have a booking link set up just yet", parroting our own instruction ("You do not have a booking link set up yet"). No-link accounts now get rule 9 "NEVER MENTION SETUP" and an instruction to collect email or phone. Accounts with a link keep the original rule 9 because the new wording cut link sharing on "any spots left?" from 8/8 to 5/8. Their prompts are byte-identical to before.
  - **Production order:** 1) run `20261010120000_outbound_lead_updated.sql`; 2) deploy (the new default list includes `lead_updated`, which the old check rejects); 3) add `lead_updated` to the Solé webhook (user `e1f2fb2c-1487-49fa-bb30-9bb8706f0281`) with `outbound-webhooks.mjs events` (check `show` first: `events` replaces the whole list).
- **TASK: Outbound lifecycle webhooks + managed accounts + persona (PR #55, branch `feat/outbound-webhooks`, built 2026-10-06; not merged, migration not run).** Infrastructure for the Mara Rue done-for-you service: Clinchd sends signed lifecycle events to the Mara Rue dashboard (`https://app.mararue.com/api/ingest/clinchd`). No Mara Rue or Katlynne names in core code; everything is per-account config. One clinic location = one Clinchd account. Contract: `docs/outbound-webhooks.md`. Setup: `docs/runbooks/managed-clinic-setup.md`.
  - **What it adds:**
    - `users.billing_managed` → access kind `managed` (billed outside Clinchd, never Stripe; /billing shows "Managed plan").
    - Server-only persona columns `assistant_name`, `business_name`, `holding_text`, plus `booking_url`, `treatment_categories` and `webhook_demo`. All are set by `scripts/managed-account.mjs`, never by the browser.
    - Outbox `outbound_webhook_events`, written by DB triggers in the same transaction as the state change (server writes only), and delivered by the per-minute cron `/api/cron/outbound-webhooks`.
    - SSRF guard on config and on every delivery. Secrets are encrypted with `ENCRYPTION_KEY`; admin is via `scripts/outbound-webhooks.mjs`.
  - **Decisions (Dom, Phase 0 review, 2026-10-06):**
    - `trigger` is always null; `trigger_type` is `comment` or `dm`.
    - Handoff mapping: medical/missing knowledge map 1:1; complex objection, qualifying loop, hostile/refund and crisis map to `other`. No event for `human_took_over` or silent pauses.
    - `treatment_interest` is a category key from the account's list, never lead text.
    - Calendly bookings match the lead by captured email first, then a unique name match. Ambiguous matches become a booking-only lead (`bkg_<id>`).
    - Retries send the same body bytes with a fresh timestamp and signature.
    - Phones default to US; ambiguous numbers are dropped.
    - Emit failures are recorded and logged by the cron.
  - **Pre-merge evidence:**
    - 790 unit tests and the DB tests passed (45 new DB assertions).
    - Live eval `scripts/eval-knowledge.mjs` 22/22 (3 trials each, 5 new persona cases). Every persona identity reply opens with "I'm Katlynne, … an AI assistant, not a person".
    - Build and lint are clean on changed files.
  - **Production order:** run migration `20261009120000_outbound_webhooks.sql` **before** the deploy. `ACCESS_COLUMNS` now selects `billing_managed`, so deploying first fails every access check closed. Verification queries and the full checklist are in the PR #55 body.
  - **First-message AI disclosure (Dom's decisions, 2026-10-06):**
    - Applies to persona accounts only (`business_name` set). The server adds "Hi! I'm {assistant_name}, {business_name}'s AI concierge." to the first assistant message actually sent in a thread. That is the inbound reply, the comment-to-DM opener, a dashboard AI reply, or a drip when it's the first thing sent; the playground is excluded. Code is in `src/lib/persona-disclosure.js`.
    - A leading "Hey!"/"Hi!"/"Hey there!" is stripped from the template or reply so there's no double greeting.
    - It never repeats: "disclosed" means a sent app message (Meta id set, source agent or drip) or any sent message containing "AI concierge".
    - A voice memo can't carry the disclosure, so the first turn on a persona account goes out as text.
    - Possessive style: "Solé Aesthetics' AI concierge", with no extra s after a name ending in s.
  - **Prompt fixes (persona accounts):**
    - No greeting after the first message.
    - Never re-ask a question already asked in the thread, including the comment opener.
    - Availability, openings and booking get the booking link in that reply, and are no longer a missing-knowledge handoff when a link exists.
  - **Comment opener in the model's history: confirmed present.** The history query loads the last 20 rows with no source filter. The earlier re-ask came from the model; the prompt rule fixed it.
  - **Found and fixed while checking: echo race on comment-to-DM.** If Meta's echo of the opener lands before the send call returns, the echo handler saved the opener as a staff message and created the thread as `native_send`. That broke the disclosure check and the `new_inquiry`/`dm_started` events. `persistCommentDmConversation` now relabels them (`source` to agent; origin to `clinchd_sent` only when the opener is the thread's only message), and the triggers emit on that relabel.
  - **Eval after the fixes** (Solé fixture, 3 trials each, server disclosure applied):
    - Pricing, first message: "Hi! I'm Katlynne, Solé Aesthetics' AI concierge. Pricing depends on the treatment area, so it's given at your consultation. What area are you thinking about treating?"
    - Openings this week, first message: disclosure plus the booking link, 3/3.
    - "BOTOX" after the disclosed opener: "What area are you thinking about treating?" 3/3, with no greeting and no re-ask.
    - "are you a real person?" as the first message: the model's own disclosure, with no second intro.
    - `scripts/eval-knowledge.mjs` 25/25 (3 new persona thread cases). 828 unit tests and the DB tests passed.
  - **Wording polish (Dom, 2026-10-06):**
    - Persona accounts always say "AI concierge", including the identity answer ("I'm Katlynne, Solé Aesthetics' AI concierge, not a person. The team can jump in when needed.").
    - The model is told the intro is prepended on first messages, so it never starts a reply with "Yeah", "Sure", "Great question" or similar.
    - Re-run (3 trials each):
      - "do you have openings this week": intro + "We do! The booking link shows live availability…" with the link, 3/3.
      - "are you a real person?": "I'm Katlynne, Solé Aesthetics' AI concierge, not a real person. The team can jump in when needed though…", 3/3.
    - Eval 25/25; 829 unit tests passed.
    - **Watch:** "We do!" asserts openings the model can't see (it only has the booking link). Fixed in the next round.
  - **Final pre-audit round (Dom, 2026-10-06):**
    - New persona rule: never say whether a time is free ("we do", "Saturday works!", "we're booked"). Point to the booking link; stating opening hours from the knowledge is fine.
    - The reply linter now rewrites a spaced hyphen used as a dash (" - " between words) like an em dash. Hyphens in words, URLs, phone numbers and ranges ("9-5", "9am - 6pm", "$300 - $500") are untouched.
    - Re-run (3 trials each):
      - "do you have openings this week": "Hi! I'm Katlynne, Solé Aesthetics' AI concierge. We're open Tuesday through Saturday, 9am to 6pm. You can check live availability and grab a spot here: <link>", 3/3.
      - "are you free Saturday?": "…We're open Saturdays 9am to 6pm! You can check live availability and grab a spot here: <link>", 3/3.
      - An earlier draft of the rule still produced "Saturdays work!" in 1/3, so the rule names that phrasing explicitly.
    - Eval 26/26 (new case `persona-free-saturday`); 842 unit tests passed.
  - **Independent audit fixes (2026-10-06):**
    - **Disclosure claim:** decided by an explicit, server-only `conversations.disclosed_at`, not inferred from text.
      - It's claimed atomically right before every send (inbound reply, comment opener, dashboard AI reply, first-sent drip). Only the claimer prepends.
      - A failed or rate-limited send releases it.
      - A brand-new comment lead's thread is created already claimed.
      - Browser writes to `disclosed_at` are rejected.
      - The text check now only skips when the exact disclosure line is already there; "our AI skin scan" or an injected "AI is cool" still get it.
    - **Calendly:** exact, case-insensitive full-name match (whitespace collapsed; `*` matches nothing). A name match attaches no invitee name or email.
    - **Linter:** "Mon - Fri" → "Mon-Fri", "Jan - Mar" → "Jan-Mar", "9am - noon" → "9am to noon", applied before the dash rules. An all-caps rule ("LA - NYC" → "LA to NYC") was dropped in the re-audit because it rewrote asides ("PRP - DM me" → "PRP to DM me"); all-caps words now take the comma.
    - **Migration:** `set lock_timeout = '3s'` at the top. Re-run it if it times out.
    - **Booking trigger:** emits only on insert, or when an update moves the status to confirmed.
    - **Delivery:**
      - An event over 5 attempts is failed.
      - Config-read, body-read and freeze errors and unexpected throws go back on the retry schedule instead of sitting in `processing`.
      - A body is never frozen from a failed read.
    - **Encryption:** `decrypt` requires the full 16-byte GCM tag (`authTagLength: 16`).
  - **Re-audit of 1f70b84 (2026-10-06):** every send path (inbound reply, comment opener, dashboard AI reply, drip) now releases the disclosure claim in a `finally` keyed on "sent", so any throw between the claim and a successful send releases it (decrypt, insert, failure handling).
  - **Accepted residuals (re-audit, 2026-10-06):**
    - A platform timeout that kills the function mid-send (after the claim, before the finally runs) can leave `disclosed_at` set without the lead having seen the disclosure.
    - A voice memo sent concurrently with a text reply can reach the lead first without the disclosure line (voice is skipped only while the claim is visibly unset).
    - Calendly name matching normalizes the invitee's name but not the stored `sender_name`, so extra whitespace there means no match: a safe miss (booking-only lead).
    - The linter's time-range rule rewrites "4pm — 5pm is booked" as "4pm to 5pm is booked".
  - **Not yet seen:** a delivery to the real Mara Rue receiver (not built yet). The runbook's `test` step is the first check.
- **Comment-to-DM clinic follow-ups (2026-10-08, from the comment-DM gaps PR).** Not built; decide before more clinic accounts:
  - **Ad comments are dropped.** Meta delivers ad and boosted-post comments on the `comments` field with `ad_id`, `ad_title` and `original_media_id` on `value.media`; `media.id` is the ad's media, not the organic post. The pipeline keys monitoring on `media.id`, and the picker only lists `/me/media` (organic, 25 most recent), so ad comments hit "no monitoring row" and skip, unlogged (only `findOrCreatePost` leaves a `WEBHOOK_INGEST` posts row behind). Fix: look up monitoring by `media.original_media_id` when present. Dynamic ads carry no ad id. Meta warns ad comments can arrive twice; the `ig_comment_id` dedup covers that. Private replies work on ad comments.
  - **Auto-watch new posts.** Today every post needs a manual toggle. Option: a per-account flag (managed accounts only) that treats a post with no monitoring row as watched with default actions, instead of skipping it. Same no-row branch in `comment-event.js`; no cron or media polling needed.
  - **Multi-comment / open-thread dedup.** One commenter on several posts gets a private reply per comment: each reply is a separate Meta send, and every opener is appended to the same thread (keyed on the IGSID). A lead mid-conversation who comments gets a template dropped into the live thread. Option: skip the DM (log `dm_skipped_open_thread`) when the commenter's thread had a message in the last N days, or already got a comment opener.
  - **Needs-attention email volume.** Every persona `queue_review` comment now emails the owner, including the default for ENGAGED_NOT_BUYING (praise). A busy post could mean dozens of emails. Watch the first clinic week; options are a digest, or setting ENGAGED_NOT_BUYING to ignore on clinic posts.
  - **AI reply path still uses only `calendly_url`** for the booking link (`prompts.js`, `lintReply` in the Instagram webhook, `/api/ai/reply`), while `booking_link_sent` also matches `booking_url`. A clinic with only `booking_url` gets no link in AI replies.
  - **Comment picker template warning is always on.** `comment-triggers/page.jsx` reads `dm_templates.body`, but the column is `template`, so "No template written" shows for every DM class.

---

## Competitive analysis

Last updated: June 2, 2026
Maintained by: Dom

TL;DR: Clinchd owns self-serve, transparent, Meta-compliant DM qualification for
English-speaking Instagram-only high-ticket coaches in the 5K to 100K follower
range. Every serious competitor is either a horizontal giant (ManyChat), a
multi-channel play (SetSmart, RipDrip), or moving upmarket and away from us
(RipDrip). The gap under $50k/mo is structurally ours to take.

### Market map

| Competitor | What it is | Model | Target | Threat level |
|---|---|---|---|---|
| ManyChat | Horizontal chat marketing giant | Self-serve SaaS | Everyone | Low direct, high brand |
| Inro | IG DM AI, strong SEO | Self-serve SaaS | IG creators / coaches | Medium (organic) |
| SetSmart | Multi-channel AI setter | Self-serve SaaS | Coaches, multi-channel | Medium (closest direct) |
| RipDrip | Done-for-you AI "sales clone" | High-touch DFY, application-gated | Coaches doing $50k/mo+ | Low now, medium later |

### Clinchd's position (the wedge)

We are the only option for the coach who:
- earns below the $50k/mo bar the done-for-you tools require,
- wants to see the price without booking a sales call,
- wants to be live today, not after a 72 hour build,
- wants to keep control of their own account and relationships,
- and wants a vendor whose compliance posture won't get their Instagram flagged.

Pricing anchor is always the human setter ($2,000 to $4,000/mo), never competing
software. Outcome framing is "qualified conversations", not "DMs".

### ManyChat

**What it is:** The dominant horizontal chat-marketing platform. Massive brand,
huge install base, broad use cases far beyond coaching.

**Why it's not a direct fight:** It's a generalist tool, not a coach-specific AI
setter. It's untouchable on brand, so we don't compete on brand.

**The one thing to watch:** "Follow to DM" is a Meta private beta exclusive to
ManyChat. It is not a public API and is not available to Clinchd or any
competitor today. If Meta opens this publicly (rough estimate 6 to 12 months),
the playing field shifts. Positioning in the meantime: comment-to-DM with
Clinchd's qualification quality is the available alternative.

**Where Clinchd wins:** Purpose-built for high-ticket coaching, AI qualification
out of the box, no flow-building busywork.

### Inro

**What it is:** Instagram DM AI aimed at creators and coaches. Real organic
growth engine.

**Primary threat vector:** SEO. They rank, and they compound. This is a marketing
threat more than a product threat.

**Where Clinchd wins / must work:** Product focus on the high-ticket coach niche
and the human-setter cost anchor. We need our own content and SEO motion (The Dark
Files flywheel is not aligned here, so Clinchd needs dedicated organic content) to
avoid ceding search.

### SetSmart

**What it is:** The closest direct competitor. French origin, multi-channel.

**The opening:** Multi-channel and non-English-first leaves the English-speaking,
Instagram-only, high-ticket coach segment underclaimed. That is exactly Clinchd's
lane.

**Where Clinchd wins:** Single-channel focus done extremely well beats
multi-channel done broadly, for this buyer. Instagram-native, English-native,
coach-native.

### RipDrip (newly researched, June 2026)

**What it is:** An AI "sales clone" for the DMs. Public brand @ripdripdm, founder
Eric Rozhko (@ericrozhko). Product domains dm.ripdrip.ai and dashboard.ripdrip.com.

**Who's behind it:** Not a fresh solo build. The legal entity is HMS Innovations,
which also runs RipDrip-AI, an older AI CRM and SMS/MMS marketing automation
platform with A2P 10DLC registration (ripdrip.com, hub.ripdrip.com,
university.ripdrip.com). The DM clone product rides on top of that existing
multi-channel infrastructure. Rozhko's background is e-commerce and performance
marketing (Alliance Agency, six-figure monthly ad spend), so the company's
strength is marketing and sales motion, likely less so deep IG-API engineering.
The "hundreds of specialized agents" claim is marketing language, treat it as
unverified.

**Model:** Fully done-for-you. Their team builds the "clone," customer touches no
code. Application required, then a demo/qualifying call. Pricing is opaque
("platform fee + usage", revealed only on the call), which signals thousands per
month. Dedicated CSM, dev team access.

**Target:** Coaches doing $50k/mo+. They explicitly state they only take clients
they're confident they can win for. They are filtering out the bottom of the
market, which is Clinchd's entire market.

**Claimed traction (unverified, from their deck):** 2,197+ coaches, 1.4M+
appointments booked, 200K+ concurrent conversations, trained on 60.3M+ DMs.
Testimonials from coaches with 9K to 290K followers (Laura Lambe 290K, Isaiah
Fergusson 194K, Wade Houston 231K, and several in the 16K to 57K range).

**Strengths:**
- Strong category validation. They've proven coaches will pay for this and raised buyer sophistication.
- Excellent "clone you / your voice" narrative. Sexier than "AI-assisted qualification."
- Durable parent company with multi-channel infra (IG + SMS + GHL integration).
- High-profile testimonial roster.

**Weaknesses / risk they carry:**
- Voice synthesis. Their EULA explicitly covers cloning/synthesizing voices and warns of regulatory scrutiny from synthetic voice indistinguishable from human speech. They're doing the riskier thing Clinchd deliberately avoids (Clinchd uses coach-recorded audio only).
- Aggressive compliance posture. Public copy uses "automate" (their DM trigger word is literally "AUTOMATE"), "bot", and "clone" freely. They likely survive this because Meta reviews the app and its data-handling materials, not a company's marketing bio, and because they route heavily through SMS/GHL and aren't dependent on IG API standing the way a pure-IG product is. Note for us: do not loosen App Review submission materials based on their example. The lesson is narrower, that our marketing copy may have more room than our review materials, and that's a post-approval experiment, not a now decision.
- Income-claim-adjacent testimonials ("$9,667 in the first week", "made 6 sales"). FTC and Meta sensitivity.
- High friction to buy. Application plus sales call plus 72 hour build is a wall for anyone who just wants to start.

**Hitlist overlap check (June 2026):** None of RipDrip's 13 named client coaches
appear on the 156-account master hitlist. But the customer profile overlaps: ~90
of 156 targets are fitness/coaching, median ~11K followers. Implication: the
larger targets (50K+ followers, likely $50k/mo+) may already be in RipDrip's
funnel, so deprioritize head-to-head there. The sub-30K, sub-$50k/mo targets are
land RipDrip contractually will not follow us onto.

**Where Clinchd wins:**
- Access: no application, no qualifying call, no gate.
- Price transparency: $97/$197 on the page vs price-on-a-call.
- Segment: built for under $50k/mo, the buyer they reject.
- Speed: live in minutes vs a 72 hour DFY build.
- Control: self-serve, coach keeps the account and relationship.
- Trust: real recorded voice, not a synthetic clone; Meta-compliant framing throughout.

### The consolidated wedge

Every competitor cedes the same buyer:
- ManyChat is too general and gates "Follow to DM."
- Inro and SetSmart are spread across creators / channels / languages.
- RipDrip explicitly refuses anyone under $50k/mo and hides its price.

Clinchd is the self-serve, transparent, Instagram-native, English-native,
compliant option for the 5K to 50K follower coach with a $1k+ offer. "The DM
setter you don't have to apply for."

### Watch-list (trigger events that change the picture)

1. **RipDrip launches a self-serve tier downmarket.** This is the real future threat, rough estimate 6 to 18 months out. If their pricing appears publicly without an application, that's a red alert and a reason to accelerate.
2. **Meta opens "Follow to DM" publicly.** Levels ManyChat's advantage and opens a feature for everyone. Build readiness to adopt fast.
3. **Inro out-publishes us on search** for coach DM terms. Counter with dedicated Clinchd organic content.
4. **SetSmart launches an English-first, Instagram-only push.** Direct collision. Defend on niche depth.
5. **Any competitor gets publicly flagged by Meta** for voice synthesis or "bot" framing. Opportunity to own the trust narrative (quietly, without naming them).

---

## Outreach copy (reference, manual send)

Kept here so the team works from one source. Not part of the site.

**Cold IG DM (short):** Hey [name], quick one. When a DM comes in from the
"[their CTA word]" posts, who's actually replying and booking the call? Curious
how you're handling that volume right now.

**Cold IG DM (problem-led):** Hey [name], saw the [niche] coaching and the "DM me
[word]" play. Genuine question: who answers all those when they land at 11pm? Most
coaches I talk to are either doing it themselves or paying a setter a few grand a
month for inconsistent results. I built a tool that answers in your style and
books the calls, live in minutes for $97. Happy to show you on your own offer, no
pitch. Want me to?

**Follow-up (3 to 4 days, no reply):** No worries if the timing's off. One thing
that might be worth 20 seconds: most of the lost money isn't the leads you miss,
it's the ones who messaged, waited an hour, and went with whoever replied first.
If you ever want to plug that gap, I'm around.

**Cold email — subject: who's answering your DMs at 2am?**
Hey [name], your "[CTA word]" posts are pulling DMs. The problem is timing. Those
leads are messaging a few coaches at once, and whoever replies first usually wins.
I built Clinchd to fix that. It answers each conversation in your tone, qualifies
the person, and books the call, around the clock. Live in minutes, $97/month, no
setup team and no application. Want me to run it on your actual offer so you can
see how it'd handle your DMs? Takes 10 minutes.
