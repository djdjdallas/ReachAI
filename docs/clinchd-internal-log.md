# Clinchd Internal Log

Living internal record. Not user-facing. One place to collect shipped changes,
open issues, positioning decisions, and competitive intel.

- **Maintained by:** Dom
- **Last updated:** October 5, 2026

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
  - **Existing schema (checked 2026-10-05):** no knowledge/FAQ table. `creator_offers` exists (`offer_name`, `offer_price_cents`, `offer_url`, `ideal_customer`, `objections`, `qualification_questions`, `deprecated_at`) and already grounds every reply path via `src/lib/active-offer.js`. Knowledge entries should sit beside it, not replace it. Script config (offer text, greeting, objections) lives in `users.script_config` JSON.

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
