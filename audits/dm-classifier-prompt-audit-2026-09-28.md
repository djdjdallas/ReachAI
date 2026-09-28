# DM Classifier & Reply-Prompt Audit — 2026-09-28

**Scope:** read-only. No code, prompt, or DB changes were made.
**Files:** `src/lib/dm-intent.js`, `src/lib/prompts.js`, `src/lib/anthropic.js` (`generateReply`, `classifyIncomingMessage`), `src/lib/classifier.js` + `src/lib/comment-trigger-rules.js` (comment side), and the wiring in `src/app/api/webhooks/instagram/route.js`.
**Prod data:** read-only SELECTs against `pwyzbsmxzxfaikfnoxxc`.

---

## TL;DR

1. **`do_not_send` is being used as the "not a fit / personal / off-topic" bucket.** 4 of the 5 `do_not_send` labels in prod were not hostile. Each one paused the thread permanently, and the owner got no email about it. The taxonomy has no bucket for "not a lead", so the model reaches for the only class that stops the reply.
2. **The reply prompt contradicts itself on identity**, and prod copied the contradiction word for word. Rule 7's example says "loop in the team", while the IDENTITY section bans "our team". A 2026-08-01 reply used the rule-7 text almost exactly.
3. **28 of 30 AI replies in the last 60 days contain em dashes.** The no-em-dash rule only exists in the *generic* writing rules. All 5 active guided coaches have a ready voice profile, so the rule is dropped for all of them. The prompt's own examples also use em dashes.
4. **Nothing in the reply prompt stops it from inventing facts.** It gets one free-text `offer` line. It never gets a price, and no rule forbids making up prices, guarantees, testimonials or results.
5. **Safety screening fails open.** A classifier timeout or error, or a `do_not_send` at 0.50–0.69 confidence, still produces an automated sales reply.
6. **"how much?" is labeled a price *objection*** (it's a prompt example). Prod: "Hola! Me das precio?" → `objection_price`. Voice routing would play the "don't worry about cost" memo to someone who is trying to buy.
7. **Prompt caching never fires on either Haiku classifier.** Haiku 4.5's minimum is 4,096 tokens. Both prompts are about 3.3–3.5K. The code comments cite 1,024 and 2,048.
8. **The comment classifier has 0 rows in prod** (`comment_classifications` is empty). Its findings (§4) are latent, but the offer grounding is hard-wired off.

---

## 1. Pipeline map (inbound DM, in order)

| Step | Where | Model | Output | Failure mode |
|---|---|---|---|---|
| Gates (handoff / paused / manual / no greeting) | route.js:1053–1105 | — | skip + `skipped` sentinel | — |
| Qualifying-loop heuristic | route.js:1290 (`detectQualifyingLoop`) | none | pause `qualifying_loop_detected` + owner email | — |
| Escalation triage (only if `human_in_loop`) | route.js:1333–1402 → anthropic.js:503 | Haiku 4.5, free-text JSON | `needs_human` → pause `complex_objection` + owner email | fail-open (reply anyway) |
| DM intent | route.js:1412 → dm-intent.js:323 | Haiku 4.5, forced tool | 7-class label; persisted; promotes status | fail-open (reply anyway) |
| `do_not_send` ≥ 0.7 | route.js:1565–1605 | — | pause, **no owner email** | — |
| Voice routing (conf ≥ 0.5) | route.js:1639 | — | voice memo for class | falls back to text |
| Reply | route.js:1776 → `generateReply` | Sonnet 4.6, T=0.7, 500 tok | text DM | skip `generation_failed` |

Other callers of `buildSystemPrompt`: dashboard `/api/ai/reply`, `/api/ai/playground`, drip `processor.js` (+ `DRIP_NUDGE_MODE`).

**Prod volume** (all-time, `messages.intent_classification`): 1,683 `skipped` sentinels, 77 real labels: follow_up 54, warm_intent 15, do_not_send 5, objection_price 2, objection_time 1. booking_cta and objection_trust: **0**. The sample is small, so treat the rates below as signals, not statistics.

---

## 2. Findings: DM intent classifier (`src/lib/dm-intent.js`)

### P0-1 · `do_not_send` is overloaded as "not a lead", and pauses silently
- The taxonomy (dm-intent.js:80–96) has no class for *personal contact / not a fit / off-topic*. `follow_up` is "keep the thread going" and `do_not_send` is "stop". The model picks `do_not_send` whenever it thinks a reply would be wrong.
- Prod `do_not_send` rows, with signals:
  - "Dispensary shop" (0.85) → `not_target_customer, wrong_fit`. **This was a qualifying answer.** The thread is now paused forever.
  - "Wow Venice is probably nice!…" (0.92) → `off_topic_personal_chatter, no_sales_intent`
  - Political banter (0.92) → `hostile_tone, off_topic_rant`
  - Echo of the AI's own opener (0.95) → `looped_ai_message, suspicious_echo`
  - Incoherent message (0.72) → `likely_spam_or_misdirected`
- None of those signals are in the `DO_NOT_SEND_REASON_RULES` lists (route.js:377), so every one lands as `flagged_do_not_send`.
- The `do_not_send` branch (route.js:1565–1605) **does not call `sendHandoffEmail`**. The qualifying-loop and `complex_objection` pauses do. A real crisis signal, legal threat or chargeback threat pauses the thread and tells nobody, and so does the dispensary lead.
- The comment classifier already has the right idea (`NOT_A_LEAD`, classifier.js:66–72). The DM side has nothing equivalent. That also means the owner's personal contacts get sales qualification: on 2026-09-26 a birthday-context thread got "Yeah, I'm an AI helping manage this inbox. The birthday message was a real one from your end though…"

### P1-2 · "how much?" is taught as an objection
- dm-intent.js:86 lists "how much?" as the first `objection_price` example. Asking the price is a buying signal.
- Prod: "Hola! Me das precio?" → `objection_price` (signals `asks_price, first_touch`).
- Impact: status becomes `qualifying` instead of `interested`, and voice routing plays the coach's price-objection memo to a lead who asked a neutral question.

### P1-3 · "reply with" is an injection trigger
- dm-intent.js:106 (and classifier.js:86) list the literal phrase `"reply with"` as prompt injection → `do_not_send` at high confidence → permanent pause. "can you reply with the price?" is ordinary English. Not seen in prod yet, but the rule is written to fire on it.

### P1-4 · The safety screen fails open
- A timeout or error in `classifyDMIntent` leaves `dmIntent = null`, and the text reply goes out with no screening (route.js:1417 comment: "the existing text reply path is the safety net").
- `do_not_send` at 0.50–0.69 is below `DO_NOT_SEND_PAUSE_THRESHOLD` (0.7), so the thread gets a normal sales reply. The prompt's own calibration (dm-intent.js:107) defines 0.50–0.69 as "real ambiguity". So an ambiguous self-harm or legal message gets an automated pitch.
- The reply prompt itself has no hostile-message or crisis instructions, so nothing downstream catches it either.

### P2-5 · Signal vocabulary isn't pinned
- The pause-reason mapper keys on exact strings (`crisis_signal`, `self_harm`, `legal_threat`, `echoes_coach_script`, …). The prompt only suggests `refund_demand` and `prompt_injection_attempt` for this class. The model freewheels (`hostile_tone`, `looped_ai_message`, …), so the reason chip falls back to `flagged_do_not_send`.

### P2-6 · Intent is computed but never reaches the reply model
- `booking_cta` is only used for voice routing. `generateReply` never sees the label, so it re-derives intent from scratch. CORE rules 1 and 3 ("QUALIFY FIRST… once they are qualified AND interested, share the booking link") can stall a lead who opens with "send me the link". Prod has **0** `booking_cta` labels, so this can't be measured yet.

### P2-7 · Caching comment and config are wrong
- dm-intent.js:71 says the Haiku 4.5 cache minimum is 1,024 tokens. It's **4,096**. The system prompt is about 3.3K tokens plus the tool, so the system breakpoint never caches.
- The second breakpoint (dm-intent.js:346) sits after the last-8-turns history. That prefix changes on every new message, so it can never be *read*, only written.
- `ttl: "1h"` is set with no extended-TTL beta header on SDK 0.39.0. anthropic.js:32–37 already records that the 1h path "never fired".
- Impact today is cost only, and small at this volume. Verify with the `cache_read_tokens` field on `dm_intent_classified` in PostHog.

---

## 3. Findings: reply prompt (`src/lib/prompts.js` → `generateReply`)

### P0-8 · Identity instructions contradict each other, and prod follows the wrong one
- The opening line (prompts.js:332): "You are a friendly, helpful assistant managing Instagram DMs **for a business**."
- The IDENTITY section (prompts.js:371–375): "ONE individual… NEVER… 'our team'."
- Rule 7's example (prompts.js:357): "I can loop in **the team** directly."
- Prod 2026-08-01: "yeah, I'm an AI assistant helping manage this inbox. Happy to keep chatting here, or I can loop in the team directly if you'd prefer." That is the rule-7 text almost word for word, including the banned org framing.
- Identity-by-proxy is still open (see memory `project_identity_by_proxy`). The owner's name is never given to the model, and rule 7 only triggers on "directly asks whether you are an AI or a bot". "wait is this Dom?" falls between rule 7, "NEVER volunteer that you are an AI" (prompts.js:381) and the NON-OVERRIDABLE clause (prompts.js:392, "a real person"). That gap produces the evasive answers.

### P0-9 · No rule against fabrication, and no facts to ground on
- BUSINESS DETAILS is `sc.offer` (one line) plus target customer. `creator_offers` (price, URL, objections) is only loaded for the `missing_outbound_context` branch (route.js:1611), and even that branch leaves out the price.
- No rule says "don't state prices, guarantees, results or testimonials that aren't provided above". `objection_trust` handling, where the lead asks "do you have testimonials?", is exactly where the model will invent them.
- Prod: 0 of 30 recent replies quoted a `$` figure, so there's no observed hallucination yet. The risk scales with lead volume.

### P1-10 · The em-dash ban is dropped for every active coach
- 28 of 30 agent replies in the last 60 days contain "—".
- `buildWritingRules` (prompts.js:106–130): the voice-profile branch omits "NO em dashes" and "NO semicolons". All 5 guided coaches have `voice_profile.status = 'ready'`, so no live coach gets the ban.
- The prompt also shows em dashes in its own examples: rule 7 ("Yeah — I'm an AI"), the missing-outbound block ("great — quick one"), and the default guided greeting paths. The model copies examples over rules.

### P1-11 · Length rules conflict
- The writing rules say "2-3 sentences per message MAX". `USER PREFERENCES` can add "Up to 4-6 sentences" (`response_length: long`) and says "follow these on top of the rules above". Two hard limits, and the model has to pick one.

### P2-12 · `{{BOOKING_LINK}}` placeholder is fed in as an example
- 3 of 5 guided coaches have `{{BOOKING_LINK}}` inside `script_config.booking_message` (generated by `generateScript`). Guided mode quotes it as "Your style should be similar to: …" (prompts.js:221). Strict mode says "use these exact messages".
- Nothing substitutes the placeholder in the DM path (only `renderTemplate` does, for comment templates). Rule 8 only covers the *no-link* case.
- Prod: 0 leaks in 30 replies. It's latent, and the substitution would be one line.

### P2-13 · Rule 6 misfires on reactions
- Rule 6 (prompts.js:355) answers emoji-only and reaction messages with "I can't quite see attachments in here — mind typing out…". A ❤️ reaction to the owner's message gets a message about attachments. It also has an em dash.

### P2-14 · No output check before send
- `generateReply` returns `content[0].text` unchecked (anthropic.js:176). A cheap lint (em dash, `{{`, markdown, length, "our team") could catch several of the issues above before they reach the lead, without touching the prompt.

---

## 4. Findings: escalation triage (`classifyIncomingMessage`, anthropic.js:503)

Runs only when `human_in_loop` is on (3 of 5 active coaches).

- **P1-15 · Escalated turns lose their intent record.** The `needs_human` branch returns at route.js:1374, *before* DM intent runs and before `recordClassification`. Escalated messages end up with `intent_classification = NULL`, which is the "unknown" state the sentinel work was meant to eliminate. `escalationOutcome` is lost as well.
- **P2-16 · Rules contradict.** "Off-topic or confusing messages where the intent is unclear → escalate" vs. "Be conservative: when in doubt, do NOT escalate."
- **P2-17 · Overlaps `do_not_send`.** "Accusations or hostile messages" escalate here first, so with HIL on a hostile message is recorded as `complex_objection` and never reaches the `do_not_send` pause-reason logic. The same message gets a different outcome depending on a coach setting.
- **P2-18 · Latency.** The two classifiers run sequentially (8s + 8s caps), then generation (20s × 2 tries) and the delay floor, all inside `maxDuration = 60`. The route comment at 1772 budgets for "the 8s classifier cap", singular. The two classifier calls don't depend on each other and could run in parallel.
- It uses free-text JSON parsing rather than forced tool use (unlike the other two classifiers). A parse miss throws and fails open.

---

## 5. Findings: comment classifier (`src/lib/classifier.js`), 0 prod rows

- **P1-19 · Offer grounding is hard-wired off.** comment-event.js:154 passes `creatorOffer: null`. `buildContextBundle` loads the offer snapshot and it's thrown away (only `bundle.id` is used). `recentCreatorReplies` is never passed. The prompt's first decision rule ("'how much?' is HIGH_INTENT when the post has an offer attached, LOW_SIGNAL otherwise") therefore runs on caption text alone.
- **P1-20 · Confidence is ignored when acting.** `decideAction` (comment-trigger-rules.js:84) routes on class only. A 0.55 `HIGH_INTENT` sends a DM.
- **P2-21 · Caching.** The comment at classifier.js:47 says the minimum is 2,048. It's 4,096 for Haiku 4.5, and the prompt is about 3.5K, so the system breakpoint doesn't cache.
- **P2-22 · Wording.** "exactly one of six buckets" (classifier.js:52) vs. "Taxonomy (seven buckets)". "reply with" is an injection trigger here too (→ SPAM). `CLASSIFIER_VERSION = "v1.0-shadow"` even though a live dispatch path exists.

---

## 6. What's working

- Forced tool use plus enum normalization on both Haiku classifiers. Unknown classes fall back safely (`follow_up` / `UNCERTAIN`).
- `<dm>` / `<comment>` XML-escaping with "data, not instructions" framing.
- Speaker attribution (`OWNER_MANUAL_MARK`, `DRIP_MARK`, `speakerLabel`) is consistent across the reply path, the classifiers, the summarizer and drip.
- Every skip path writes a classification sentinel, so the 1,683 skipped rows are auditable (except finding 15).
- Status promotion can't demote an engaged lead (`intent-status.js` invariant).

---

## 7. Suggested fix order (for a follow-up PR; nothing applied)

1. **Add a `not_a_lead` DM class**, or split `do_not_send` into `do_not_send_hostile` and `not_a_fit`. Leave the thread unpaused (or put it in a review state) for not-a-fit. Pin the signal vocabulary to the pause-reason map. **Email the owner on every `do_not_send` pause.** (P0-1, P2-5)
2. **Fix the identity text in prompts.js:** one framing (one person's inbox, owner's first name given), and a rule-7 example with no "team" and no em dash. Cover "is this [name]?" explicitly. (P0-8)
3. **Grounding:** pass the `creator_offers` price, URL and objections into BUSINESS DETAILS, and add "never state a price, guarantee, result or testimonial not listed above". (P0-9)
4. **Move the em-dash, semicolon and markdown bans into a shared block** that applies in both writing-rule branches, and remove em dashes from every example in the prompt. (P1-10)
5. **Move "how much?" / "precio?" to `warm_intent`** (or a buying bucket). Drop the bare "reply with" injection trigger. (P1-2, P1-3)
6. **Any `do_not_send` label, at any confidence, suppresses the auto-reply for that turn**, with a pause only at ≥ 0.7. Decide deliberately whether a classifier failure should fail open. (P1-4)
7. **Persist intent on escalated turns** and run the two classifiers in parallel. (P1-15, P2-18)
8. **Comment side:** pass the bundle's `offerSnapshot`, and add a confidence floor for `HIGH_INTENT → dm`. (P1-19, P1-20)
9. **Housekeeping:** correct the cache-minimum comments, and either pad the prompts past 4,096 tokens or drop the dead breakpoints. Remove `ttl: "1h"`. Substitute `{{BOOKING_LINK}}`. Add a pre-send lint. (P2s)

Before changing prompts, save the 77 labeled prod rows plus the 30 recent replies as a regression set, so each change can be checked against real messages rather than the few-shots.

---

## 8. Execution plan (decided 2026-09-28)

**Decisions**
- `not_a_lead` (personal / off-topic): **no reply that turn, thread not paused**, dashboard skip reason `not_a_lead`.
- Owner email on `do_not_send` pause: **hostile / refund / chargeback / legal / hate / crisis only**. Injection and spam stay silent (keeps the spam-suppression intent in `handoff-email.js:15`).
- Classifier timeout/error: **keep fail-open**, recorded as a sentinel. `do_not_send` at any confidence holds the turn; pause only at ≥ 0.7.

**Constraints found:** `conversations.ai_pause_reason` is free text with no CHECK. `intent_classification` is jsonb. Intent-class CHECKs exist only on the drip/voice tables, and `not_a_lead` is never drip- or voice-eligible. So PRs A–C need **no migration**. The owner name comes from the first word of `users.full_name` (5 of 6 active coaches have it), falling back to `instagram_username`.

| PR | Scope | Findings |
|---|---|---|
| 0 | vitest units (pause-reason map, `statusForIntent`, prompt invariants) + replay script over the 77 labeled prod rows and hand-written cases (Haiku calls, < $1/run) | — |
| A | DM taxonomy: `not_a_lead`, narrowed `do_not_send`, price→warm_intent, drop "reply with", pinned signals, hold-on-any-DNS, selective owner email, cache cleanup, dashboard chips, manual SQL to unpause the 4 misfiled threads | P0-1, P1-2, P1-3, P1-4, P2-5, P2-7 |
| B | Reply prompt: single named-owner identity + "is this [name]?", offer grounding in all 4 callers + no-fabrication rule, shared format block, examples de-dashed, length precedence, `{{BOOKING_LINK}}` substitution, rule 6 reactions, optional booking_cta hint, pre-send lint | P0-8, P0-9, P1-10, P1-11, P2-12, P2-13, P2-14 |
| C | Escalation: run in parallel with DM intent (DNS wins), always persist intent, fix contradictory rules, forced tool use | P1-15, P2-16, P2-17, P2-18 |
| D | Comment side: pass offerSnapshot, HIGH_INTENT confidence floor, wording | P1-19, P1-20, P2-21, P2-22 |

Order: 0 → A → B → C → D. A and B can run in parallel once 0 exists. One branch and one PR each, cut from `claude/build-reachai-app-PeuJk`.

---

## 9. PR 0 baseline (classifier v1.0, 2026-09-28)

`node --env-file=.env.local --import ./scripts/_ext-loader.mjs scripts/replay-dm-intent.mjs`

| Set | Correct | Critical | Breakdown |
|---|---|---|---|
| prod (75 gold rows) | 53 (71%) | 17 | 12 AI replies to a personal contact, 5 wrongful `do_not_send` |
| synthetic (20) | 14 (70%) | 4 | 3 wrongful `do_not_send`, 1 personal-contact reply |

- The replay reproduced all 4 wrongful prod pauses and added one ("How are you bro" → `do_not_send` 0.85).
- Real hostility, crisis, legal and injection were all caught (4/4).
- **P1-3 did not reproduce:** "can you reply with the price?" was classified correctly. The trigger phrase is still in the prompt, but this is downgraded to P2.
- "how much is it?" and "Me das precio?" → `objection_price`, and both "meeting link?" cases → `follow_up`. This confirms P1-2 and the booking_cta blind spot.
- Personal contacts are the largest error class: 29 rows with gold `not_a_lead` were predicted 17 × `follow_up`, 8 × `warm_intent` and 4 × `do_not_send`.

PR A success bar: 0 critical misses on both sets under `--strict`, with prod accuracy not below 71%.

---

## 10. PR A result (classifier v1.1, 2026-09-28)

| Set | v1.0 baseline | v1.1 |
|---|---|---|
| prod (75) | 53 correct, 17 critical | 71 correct, **0 critical** |
| synthetic (20) | 14 correct, 4 critical | 20 correct, **0 critical** |

- Remaining prod misses are harmless: 2 openers labeled `follow_up` rather than `warm_intent`, "Broo" labeled `warm_intent`, and 1 transient 8s timeout during the concurrent replay.
- "Dispensary shop" is now `follow_up`. It first came back `not_a_lead`; fixed by stating that `not_a_lead` is about who is writing, not fit.
- The prompt grew to ~4,750 tokens, which crosses Haiku's 4,096 cache minimum. Caching now fires: 4,748 cache-read tokens per call after the first.
- **Remediation:** `scripts/review-dns-paused-threads.mjs` found 19 threads paused for a do_not_send reason.
  - 3 are v1.0 misfires and are proposed for UNPAUSE: Dom's test thread, the Venice chat, and the political thread.
  - 16 have no messages left (deleted), are on other coaches' accounts, and are left untouched.
