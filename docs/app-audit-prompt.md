# Clinchd / ReachAI — App Audit & Roadmap Prompt

Paste the prompt below into a fresh Claude Code session (ideally on a clean branch) to get a
structured audit of fixes + a prioritized list of new features. It's tailored to this codebase:
Next.js 16 (App Router) / React 19, Supabase, Anthropic SDK, Stripe, Twilio, Resend, PostHog,
deployed on Vercel. Core domain = Instagram comment/DM automation with AI auto-replies, lead
qualification, drip sequences, voice replies, and Calendly/Google Calendar booking.

---

## THE PROMPT

You are auditing the **Clinchd** codebase (an Instagram DM/comment automation + AI setter app for
coaches). Tech stack: Next.js 16 App Router, React 19, JavaScript (jsconfig, not TS), Supabase
(Postgres + RLS + auth), Anthropic SDK for AI replies, Stripe billing, Twilio, Resend email,
PostHog analytics, Vercel hosting with cron jobs.

Your job is to produce **two deliverables**:
1. A prioritized list of **fixes** (bugs, security, correctness, reliability, perf, UX/a11y).
2. A prioritized list of **new feature recommendations** that fit the product and codebase.

Do NOT make code changes. This is a read-and-report pass. Write findings to
`audits/app-audit-<today>.md`.

### Scope — walk these areas

Webhook & messaging core (highest risk):
- `src/app/api/webhooks/instagram` — inbound DM/comment ingestion; verify signature validation,
  idempotency/dedup, IGSID matching (note: comment `value.from.id` == inbound `event.sender.id`),
  origin classification (comment-to-DM vs native DM), and error handling.
- `src/app/api/webhooks/stripe` and `src/app/api/webhooks/calendly` — signature verification,
  replay protection, per-user webhook signing keys (Calendly).
- `src/lib/comment-to-dm-gate.js`, `src/lib/comment-dm-conversation.js`,
  `src/lib/comment-public-reply.js`, `src/lib/comment-trigger-rules.js`, `src/lib/native-send.js`.

AI / reply pipeline:
- `src/lib/prompts.js`, `src/lib/anthropic.js`, `src/lib/anthropic/*`, `src/lib/classifier.js`,
  `src/lib/dm-intent.js`, `src/lib/objections.js`, `src/lib/contextBundle.js`.
- `src/app/api/ai/*` (reply, summarize, generate-script, voice-chat, playground, analyze-voice).
- Check: prompt-injection exposure from attacker-controlled DM text, identity-by-proxy handling
  ("wait, is this Dom?" should not get evasive replies — see rule 7 in prompts.js), token budgeting,
  model selection (should target the latest Claude models), cost controls, and rate limiting.
- Intent router safety: verify `DO_NOT_SEND_PAUSE_THRESHOLD` and `VOICE_ROUTING_THRESHOLD` behave
  correctly, the multi-classifier (intent/sentiment/action) degrades gracefully on API failure, and
  shadow-mode F1 tracking can't accidentally send live replies.

Drip / scheduling / cron:
- `src/lib/drip/*`, `src/app/api/drip*`, `src/app/api/cron/*` (drip, drip-process, refresh-tokens).
- Check: cron auth (every cron endpoint should require `CRON_SECRET`), queue idempotency, token
  refresh failure handling, timezone/date correctness (shared util is `src/lib/dates.js` — flag any
  surface bypassing it). Vercel runs 3 crons: token-refresh (daily 6am UTC), drip send (daily 2pm
  UTC), drip-process (every 15 min) — see `vercel.json`.

Integrations & auth:
- `src/lib/calendly.js`, `src/lib/google-calendar.js`, `src/lib/instagram.js`, `src/lib/encryption.js`,
  `src/lib/token-utils.js`, `src/app/api/auth/*` (instagram, calendly, google-calendar), Stripe billing
  in `src/lib/stripe.js` / `src/lib/plan.js` / `src/lib/plans.js`.
- Check: OAuth token storage/encryption at rest, token refresh, scope handling, secret management.

Data layer & multi-tenancy:
- `src/lib/supabase/*`, `migrations/`, `supabase/`. Verify Row Level Security is enforced on every
  user-scoped table, server vs browser client usage is correct, and no service-role key leaks to the
  client. Flag any query missing a user/tenant filter.

Dashboard & frontend:
- `src/app/(dashboard)`, `src/app/(onboarding)`, `src/app/(auth)`, `src/components/app`,
  `src/components/drip`, `src/components/voice`, `src/components/ui`.
- Check: loading/error states, optimistic-update correctness, accessibility, and consistency of
  timestamp rendering (must route through `src/lib/dates.js`).

Cross-cutting:
- `src/lib/rate-limit.js`, `src/lib/logger.js`, `src/lib/notifications.js`, `src/lib/featureFlags.js`,
  `next.config.mjs`, `vercel.json`, `env.local.example`. Check for leaked secrets, missing env-var
  validation, and overly permissive CORS/headers. Run `npm run lint` and report results.
- Testing gap: there is currently **no test suite** (no Jest/Vitest) and **no pre-commit hooks**.
  Note where the lack of tests is riskiest (webhook parsing, gate logic, drip queue, dates) and
  recommend a minimal high-value test setup.

### Method
1. Read `SHIPPED.md`, `README.md`, recent files in `docs/` and `audits/` first for context and to
   avoid re-reporting known/closed issues.
2. Trace the critical path end-to-end: inbound webhook → classify → gate → AI reply → send → persist
   → dashboard surface. Note every place data can be dropped, duplicated, or mis-attributed.
3. For each finding, give: **severity** (P0/P1/P2/P3), file:line, what's wrong, why it matters,
   and a concrete fix. Cite real code — no speculative findings.
4. For features, propose ideas grounded in what exists (e.g. extend drip, comment triggers, voice,
   booking). For each: problem it solves, rough implementation sketch (files/tables touched),
   effort (S/M/L), and impact.

### Output format (`audits/app-audit-<today>.md`)
- **Summary** — health snapshot, top 3 risks, top 3 feature bets.
- **Fixes** — table sorted by severity: ID | Severity | Area | File:line | Issue | Fix.
- **Security findings** — called out separately (RLS gaps, secret/auth/webhook issues).
- **New features** — table: Feature | Problem solved | Sketch | Effort | Impact.
- **Quick wins** — <1hr changes worth doing now.

Be specific and honest. If something looks fine, say so rather than inventing problems.

---

## Tips for running it
- Run on a clean branch so the auditor isn't confused by in-flight work.
- For a deeper pass, ask Claude to use a **workflow** (multi-agent fan-out) — one agent per scope
  area, then synthesize. Say "use a workflow" to opt in.
- To turn findings into work, follow up with: "Implement the P0 and P1 fixes from the audit, one
  commit each, tests where practical."
