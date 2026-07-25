# Reply Latency Audit — 2026-07-25

Read-only diagnostic of the inbound-DM → AI-reply chain, prompted by a returning
customer (Spanish-language fitness coach, 503K followers, high DM volume) who
reported June response times felt "poco naturales." He starts a 60-day
evaluation Tuesday. No code was changed in this audit.

## TL;DR (the sentence to repeat)

**Replies land roughly 4–10 seconds after the lead hits send, every time, as a
full text paragraph, with no typing indicator, no configurable pacing (the
Response Delay setting is saved but never read), and occasional double-replies
when a lead sends two messages quickly.** The "unnatural" complaint is almost
certainly the instant-bot direction, compounded by double-fires — not slowness.

- Was the delay feature functional during his June window? **No.**
- Is it functional today? **No.** It has never been wired to the send path.

---

## 1. The latency chain (all synchronous, in the webhook request)

Everything below runs inline inside `POST /api/webhooks/instagram` before the
200 is returned to Meta. Nothing is queued. File: `src/app/api/webhooks/instagram/route.js`.

| # | Hop | Where | Sync? | Est. time |
|---|-----|-------|-------|-----------|
| 1 | HMAC verification | route.js:59–88 | inline | ~0 ms |
| 2 | Owner lookup + lead profile fetch (graph.instagram.com) | route.js:132–151 | inline, awaited | 200–600 ms |
| 3 | Gates + conversation find/create + message insert (~6–10 serial Supabase round trips) | route.js:641–830 | inline | 300–900 ms |
| 4 | **Hardcoded "natural delay" sleep: 1,000–3,000 ms uniform jitter** | route.js:862 | inline `setTimeout` | 1–3 s |
| 5 | History fetch (newest 20) | route.js:868–880 | inline | 30–100 ms |
| 6 | `classifyIncomingMessage` (Haiku, only if `human_in_loop` on) | route.js:919–956, anthropic.js:402 | inline, awaited | 0.4–1.5 s |
| 7 | `classifyDMIntent` (Haiku, always-on; ~3k-token cached system prompt, ~100–150 output tokens, 8 s race timeout) | route.js:968–979, dm-intent.js:318–426 | inline, awaited, **serial after #6** | 0.7–2 s |
| 8 | Intent persistence + telemetry | route.js:983–1056 | inline (small) | 100–300 ms |
| 9 | `generateReply` (Sonnet 4.6, max_tokens 500, typical DM output 30–150 tokens; **no app-level timeout**) | route.js:1304, anthropic.js:65–79 | inline, awaited | 1.5–4 s typical; 8–15 s+ tail |
| 10 | Reply insert + rate-limit RPC | route.js:1318–1356 | inline | 100–250 ms |
| 11 | Send to graph.instagram.com (single attempt, no retry) | route.js:1361, instagram.js:195–217 | inline, awaited | 300–1,000 ms |

**Sum, lead-hits-send → reply-lands:**
- **Min ~4 s** (warm function, 1 s sleep, cache hits, human_in_loop off)
- **Typical ~6–10 s**
- **p95 ~15–25 s** (classifier near its 8 s cap, slow Sonnet turn, cold start)
- **Worst: never.** See Finding 2.

The two classifier calls are strictly serial with each other and with reply
generation — nothing is parallelized or deferred. The voice-reply branch
(route.js:1184–1300) skips hop 9 when it fires, so voice replies are slightly
*faster* than text.

---

## 2. The Response Delay feature — FINDING: it is silently dead (case c)

This is the audit's headline. The configurable delay **saves to the database
and is never read by any send path.**

- **Setting UI:** Settings page, "Response Delay (seconds)" number input,
  range **1–120** (not 240 as believed), step 1 —
  `src/app/(dashboard)/settings/page.js:1256–1278`. Copy promises: *"Add a
  delay (1–120 seconds) before the agent responds to feel more natural and
  comply with platform guidelines."*
- **Persistence:** clamped 1–120 and written to `users.response_delay` —
  settings/page.js:364–370. Column: `supabase/migrations/002_production_fixes.sql`
  (`INTEGER DEFAULT 2`). **Per-account**, not per-conversation.
- **Enforcement: none.** `grep -r response_delay` across the entire repo hits
  exactly two files: the migration and the settings page. The webhook, the
  drip processor, the comment-to-DM path — nothing reads it.
- **What actually delays replies:** a hardcoded, non-configurable
  `await new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000))` —
  route.js:862. So the *applied* delay is 1–3 s uniform jitter regardless of
  what the coach sets. A coach who sets 60 s still gets ~2 s.
- **History:** both the dead column and the hardcoded sleep date to the
  initial commit `c165c72` (2026-05-07). No commit since has touched either.
  **Nothing in the reply-latency chain changed between June 27 and today**
  (July commits: echo capture 7/14, triage labels 7/18, drip fire-time checks
  7/23 — none alter reply timing).
- **Typing indicator:** no `sender_action` / `typing_on` / `mark_seen`
  anywhere in the codebase. The 1–3 s gap is silent, then a full paragraph.

Because the real delay is only 1–3 s, the interaction questions mostly
collapse, but for the record: the pause/ai_paused gate is checked **once at
receipt** (route.js:773), before the sleep and the ~3–8 s of model calls — a
coach hitting pause mid-flight does not stop an in-flight reply. Harmless at
2 s; it becomes a real bug the moment a genuine 60–120 s delay is wired in.

---

## 3. Variance and tail latency (the slow direction)

- **Function config:** the webhook route exports **no `maxDuration`**, and
  `vercel.json` has no `functions` block (crons only). The route runs at the
  project's plan/Fluid-compute default. On legacy defaults (10–15 s) the
  typical chain already grazes the ceiling; p95 exceeds it.
- **Finding 2 — the ghosting mechanism (HIGH):** the inbound message is
  inserted (route.js:823) *before* the sleep and model calls. If the function
  is killed mid-chain (timeout) or Meta times out waiting for the 200 and
  redelivers, the redelivered event hits the dedupe check
  (route.js:317–331 + unique index in migration 005) and **returns without
  replying** (route.js:830). Net effect: the lead's message is recorded, no
  reply is ever sent, no error is logged. Dead air — the *other* direction of
  "poco naturales."
- **Anthropic retry/timeout:** `generateReply` has no `withTimeout` wrapper
  (unlike `classifyDMIntent`'s 8 s race). The SDK default is 2 retries with a
  ~10-minute per-attempt timeout — an Anthropic incident turns into the
  function dying at maxDuration, which feeds Finding 2. p99 is effectively
  "killed, never sent," not "slow."
- **Meta send failures:** single attempt, no retry, no backoff
  (instagram.js:195–217). On failure the reply is saved to the DB and the
  lead silently gets nothing (route.js:1382–1390 comment says so explicitly).
- **Concurrency / rapid successive messages (MEDIUM):** there is no
  per-conversation lock, debounce, or coalescing. Two DMs sent 3 s apart
  arrive as separate webhook deliveries, run two full chains concurrently,
  and **each generates and sends its own reply**. With the 1–3 s random sleep
  and variable model latency, the replies can land out of order, and the
  second reply may have been generated without the first reply in its history
  (fetched pre-insert). A lead who types "hola" / "vi tu post" / "cuánto
  cuesta?" as three messages gets up to three paragraph replies — a strong
  bot tell.

---

## 4. Verdict

**Ranked explanations for the June complaint:**

1. **(a) Instant-reply bot-feel — most plausible.** Uniform ~4–10 s
   paragraph-length replies at any hour, zero typing indicator, no
   length-scaled pacing, and the one knob that was supposed to humanize it
   (Response Delay) has been dead since day one. A human answering a
   qualifying question with 3 sentences in 6 seconds, every single time, in
   the middle of the night, reads as a bot. For a 503K-follower account the
   lead volume makes the pattern obvious fast.
2. **(a′) Double/out-of-order replies on rapid messages — strong secondary
   contributor.** Spanish-language DM culture skews heavily toward
   multi-message bursts; every burst risks a multi-reply pile-up (Finding 4).
3. **(b) Slow/inconsistent tail — real but episodic.** The
   timeout-then-dedupe ghosting (Finding 2) and unretried Meta send failures
   produce occasional *total silence*, which a coach reviewing threads would
   more likely report as "no contestó" than "poco natural." Contributes, not
   primary.

**Delay feature functional in June? No. Functional today? No.**

---

## 5. Severity-ranked findings

| Sev | Finding | Location |
|-----|---------|----------|
| **HIGH** | `response_delay` setting saves but is never read — replies ignore it entirely; UI copy promises behavior that doesn't exist (a compliance claim, too) | settings/page.js:364–370, 1256–1278; migrations/002; no reader anywhere |
| **HIGH** | Timeout/redelivery + early dedupe insert = reply never sends, silently (dead-air ghosting) | route.js:823–830, 862, 1304; no `maxDuration` export |
| **MEDIUM** | No debounce/lock for rapid successive messages → duplicate, racing, out-of-order replies | route.js:105–165, 625+ |
| **MEDIUM** | `generateReply` unbounded (no app timeout; SDK 2×10-min retries) → tail feeds the HIGH ghosting finding | anthropic.js:65–79 |
| **MEDIUM** | Constant robotic cadence: hardcoded 1–3 s jitter, no typing indicator, no length scaling | route.js:862; no `sender_action` in repo |
| **LOW** | Meta send is single-attempt, no retry; failed sends strand the reply in the DB silently | instagram.js:195–217; route.js:1382–1390 |
| **LOW** | Pause/ai_paused checked at receipt only, not at send time (latent — becomes real when any true delay ships) | route.js:773 vs 1358 |

---

## 6. Humanization options (sketches only — nothing built)

**Option 1 — Typing indicator + mark_seen (cheapest, ship-first).**
Send `sender_action: mark_seen` on receipt and `typing_on` just before/during
`generateReply` via the same `/{igAccountId}/messages` endpoint
(instagram.js). Meta's Instagram Messaging API supports sender actions. Hooks
in at route.js ~line 860 and ~1300. No 24h-window interaction, no drip
interaction, no serverless risk. Effort: ~half a day. This alone converts
"silent gap then paragraph" into "seen → typing → reply."

**Option 2 — Delay floor with jitter scaled to reply length (in-function, capped ~15–20 s).**
Generate the reply first, then sleep `base + perWord × words ± jitter` with
`typing_on` active, then send. Honest up to ~15–20 s only: requires exporting
`maxDuration` well above the cap, bills wall-time on every DM, and holding the
200 longer invites Meta redelivery — **do not implement the existing 120 s
setting this way; a 120 s in-function sleep is a guaranteed timeout/redelivery
factory.** Must re-check `ai_paused` after the sleep (Finding 7). Effort: ~1 day.
Clamp the settings UI to the real cap or it's dishonest again.

**Option 3 — Queue-based deferred send (the only correct home for 30–120 s delays).**
Persist the generated reply to a `scheduled_replies` row and fire it from a
worker, mirroring the drip system's shape — including its fire-time re-checks
(`ai_paused`, 24h-window margin, superseded-by-new-inbound; see
src/lib/drip/processor.js:73–135, which already models exactly the right
checks). Constraint: the existing drip cron runs every 15 min
(vercel.json) — far too coarse for seconds-level delays, so this needs a
delayed-callback primitive (e.g. QStash-style delayed HTTP, or a per-minute
cron accepting minute granularity). Bonus: a "supersede if the lead sent
another message before fire time" check also fixes the double-reply burst
problem (Finding 4) by collapsing bursts into one reply. Effort: 3–5 days.
Risk to 24h window: none if the fire-time re-check refuses within the same
60-min margin the drip processor uses.

Recommended sequence for the Tuesday evaluation: Option 1 immediately, plus
raising `maxDuration` on the webhook route and an app-level timeout on
`generateReply` (kills the ghosting tail), then Option 3 to make the Response
Delay setting real — or remove/relabel the setting until it is.
