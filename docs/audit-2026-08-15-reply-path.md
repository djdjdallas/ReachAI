# Reply-path audit — 2026-08-15

Read-only investigation of the Instagram DM reply pipeline, covering classifier
observability, manual-message ingestion, reply gating, and prompt construction.

All citations are `file:line` against the tree at commit `c61836a`.

---

## Corrections to the brief

Three premises in the task brief do not survive contact with the production data.
They are stated here up front because two of them change where the fix has to go.

**1. The history→Anthropic mapping is not in `src/lib/prompts.js`.**
`prompts.js` builds only the *system prompt string*. The `messages` array is
built in `generateReply` at `src/lib/anthropic.js:73-76`. Speaker labelling
(Phase 3) therefore has to touch three files, not one: the SELECT that drops
`source` (`route.js:973`), the mapper (`anthropic.js:73-76`), and the system
prompt (`prompts.js`).

**2. `conversations.last_skip_reason` is not NULL on every row.**
27 of 325 conversations carry a value. `markSkip` exists and works
(`route.js:214-220`); it is simply not called on the branches that matter. The
gap is coverage, not a missing writer.

**3. `intent_classification` coverage is 74/221 (33%) of inbound lead rows, not
54/308 (18%).** The 308 denominator includes 195 `role='assistant'` rows, which
are never classified by design — the classifier only ever runs on inbound. The
real question is why 147 *inbound* rows are NULL, and the answer is in Q7 below.

```
 role      | source | rows | classified
-----------+--------+------+-----------
 user      | lead   |  221 |         74
 assistant | manual |   99 |          0
 assistant | agent  |   92 |          0
 assistant | drip   |    4 |          0
```

---

## A. Classifier execution and persistence

**A1. Where is `classifyIncomingMessage` defined, and from which files is it
called?**

Defined at `src/lib/anthropic.js:409`. Exactly one call site:
`src/app/api/webhooks/instagram/route.js:1032` (imported at `route.js:3`).

Note there are **two** classifiers in this path and they are easy to confuse:

| | `classifyIncomingMessage` | `classifyDMIntent` |
|---|---|---|
| Defined | `anthropic.js:409` | `dm-intent.js:~296` |
| Called | `route.js:1032` | `route.js:1086` |
| Gated by | `sc.human_in_loop` (`route.js:1026`) | always-on |
| Purpose | escalate-to-human verdict | intent class + voice routing |
| Persisted to `intent_classification` | **never** | yes (`route.js:1101-1114`) |
| Wrapped in 8s `withTimeout` | yes | internally |

The 8-second race in the brief belongs to `classifyIncomingMessage`; the column
`intent_classification` is written from `classifyDMIntent`. They are different
calls with different failure modes.

**A2. Is classification called before or after the assistant row is inserted?**

Before, both of them. Order in `processIncomingMessage`:

- inbound lead row inserted — `route.js:863-869`
- `classifyIncomingMessage` — `route.js:1031-1035`
- `classifyDMIntent` — `route.js:1086-1091`
- outbound assistant row inserted — `route.js:1471-1480`

**A3. Is the result written to `messages.intent_classification`? On which
statement, for which message?**

Yes, at `route.js:1101-1114`. It is an `UPDATE ... WHERE conversation_id = ? AND
provider_message_id = ?` — `providerMessageId` is the *inbound* Meta mid, so the
write lands on the **inbound lead row**. That is the correct target and matches
what `drip/processor.js:139` reads back (`lastLeadMessage.intent_classification`).

The write is guarded:

```js
// route.js:1099
if (dmIntent && providerMessageId) {
```

`classifyIncomingMessage`'s verdict is never persisted anywhere.

**A4. On `withTimeout` timeout, what is the return value, and does the caller
skip or reply anyway?**

`withTimeout` **rejects**; it does not resolve a sentinel (`dm-intent.js:244-261`):

```js
const timer = setTimeout(
  () => reject(new Error(`${label} timed out after ${ms}ms`)),
  ms
);
```

The caller catches and **replies anyway** — fail-open (`route.js:1065-1071`):

```js
} catch (err) {
  console.warn(
    "[webhook] classifier failed, falling through for conversation:",
    conversation.id,
    err?.message
  );
}
```

`classifyDMIntent` fails open the same way at `route.js:1092-1094`, leaving
`dmIntent = null`.

**A5. On classifier error or timeout, is anything persisted?**

No. Both failures are silent apart from a `console.warn`. The
`classifyIncomingMessage` catch (`route.js:1065-1071`) writes nothing. A
`classifyDMIntent` failure leaves `dmIntent = null`, which fails the guard at
`route.js:1099`, so `intent_classification` stays NULL — indistinguishable from
"never ran".

**A6. What writes `conversations.last_skip_reason`?**

Writers:
- `markSkip` — `route.js:214-220`
- `markSkipForSender` — `route.js:225-232`
- qualifying-loop pause — `route.js:1001`
- cleared on voice send — `route.js:1387`
- cleared on text send — `route.js:1484`

Called from: `route.js:699` (`subscription_inactive`), `711` (`trial_expired`),
`837` (`no_greeting`), `857` (`dm_limit`), `1331` (voice post-delay gate), `1463`
(text post-delay gate).

**Suppression branches that write nothing** — this is the observability gap:

| Branch | Line | Missing token |
|---|---|---|
| `ai_mode === "off"` | `route.js:803` | `ai_mode_off` |
| handoff / `ai_paused` / `status='manual'` | `route.js:812-825` | `ai_inactive` / `ai_paused` / `human_takeover` |
| duplicate message | `route.js:870` | `duplicate_message` |
| history fetch failed | `route.js:978-983` | `history_fetch_failed` |
| `do_not_send` pause | `route.js:1231-1267` | `do_not_send` |
| `generateReply` threw | `route.js:1443-1452` | `generation_failed` |
| outbound rate limit | `route.js:1498-1507` | `rate_limited` |
| classifier timeout | `route.js:1065-1071` | (fails open — records only) |

**A7. Is classification gated behind a flag, plan check, `ai_mode`, or env var?**

- `classifyIncomingMessage` is gated behind `sc.human_in_loop` (`route.js:1026`).
- `classifyDMIntent` — the one that populates the column — has **no flag**. But
  it sits at `route.js:1086`, *after* the early-return gate at `route.js:812-825`.
  Any thread that is `ai_paused` or `status='manual'` inserts its inbound row at
  `route.js:817-823` and returns at `824` — the classifier never runs.

That is the whole story on coverage. Grouping the 115 lead rows since 2026-07-15
by the gating fields:

```
 status    | ai_paused | rows | classified
-----------+-----------+------+-----------
 manual    | false     |   51 |         18
 not_a_fit | true      |   28 |          8
 manual    | true      |   16 |          0   <- gated, never classified
 qualifying| false     |   13 |         11
 qualifying| true      |    4 |          1
 new       | false     |    3 |          3
```

Unpaused, ungated threads classify at ~85%. Paused threads classify at ~4%, and
those few predate the pause. `provider_message_id` is non-NULL on **every** lead
row in the table, so the second half of the `route.js:1099` guard is never the
cause. The remainder of the NULLs are rows written before `classifyDMIntent`
shipped (April: 0/17, May: 3/34).

---

## B. Manual message ingestion

**B8. Every code path that can insert `source='manual'`.**

Exactly two:

1. **Instagram echo handler** — `route.js:546-552`. Fires when the account owner
   types in the native Instagram app (or any non-Clinchd surface).
2. **Dashboard send endpoint** — `src/app/api/ai/reply/route.js:171`,
   `source: manual ? "manual" : "agent"`, when the request body carries
   `manual: true`.

Adjacent paths that write assistant rows with a *different* source, and must
therefore **not** trigger the pause: `route.js:630` and `src/lib/native-send.js:47`
(`native_send`), `src/lib/drip/processor.js:215` (`drip`),
`route.js:1378` and `route.js:1477` and `src/lib/comment-dm-conversation.js:74`
(`agent`).

**B9. Does Meta deliver native-app replies as an echo?**

Yes, and it is confirmed live. `route.js:127-130` dispatches on
`event.message?.is_echo` into `handleEchoEvent` (`route.js:397-556`), which
inverts sender/recipient (`route.js:401-402`), finds-or-creates the conversation,
skips rows that are twins of app-sent messages (`route.js:523-542`), and inserts
with `role: "assistant"`, `source: "manual"` at `route.js:546-552`.

Evidence it is the live path: every manual row on the incident thread carries a
`provider_message_id`, and the thread's `origin='inbound'` — the owner typed in
the Instagram app, and the echo is how those messages reached the database.

**This is the primary path.** 99 of 195 assistant rows in production are
`source='manual'` — more than the 92 the AI produced.

**B10. Does the dashboard have its own send endpoint?**

Yes. `src/app/(dashboard)/conversations/page.js:426-435` POSTs to `/api/ai/reply`
with `manual: true`; the row is written at `src/app/api/ai/reply/route.js:165-174`
with `source: 'manual'`.

**B11. Is there a backfill or import routine?**

Yes, but it does not write `manual`. `/api/native-send/backfill/route.js` →
`attachToConversation` in `src/lib/native-send.js:43-49` inserts with
`source: 'native_send'`. The webhook's inline equivalent is `route.js:626-632`,
same source. There is **no** Meta conversation-history import routine in the
codebase.

---

## C. Reply gating

**C12. Where is `ai_paused` read before generating a reply?**

Two gates, both in `processIncomingMessage`:

1. Receipt-time — `route.js:812-816`
2. Post-delay re-check — `route.js:954-956`

Nothing else in the reply path reads it. (`drip/processor.js` has its own gate,
out of scope here.)

**C13. Does the post-delay re-check re-read from the database?**

It exists at `route.js:921-965` and it **already re-reads from the database** —
this is not a stale-value bug:

```js
// route.js:926-938
const [convRes, userRes] = await Promise.all([
  supabase
    .from("conversations")
    .select("ai_paused, status")
    .eq("id", conversation.id)
    .maybeSingle(),
  supabase
    .from("users")
    .select("ai_mode")
    .eq("id", user.id)
    .maybeSingle(),
]);
```

Fail-open on query error (`route.js:939-945`) and on throw (`route.js:961-964`).
No change required for Phase 2 item 4 beyond confirming it.

**C14. Does `status='manual'` gate anything?**

Yes, it is functional, not display-only: `route.js:815` (receipt-time) and
`route.js:957` (post-delay). The comment at `route.js:806-811` records that this
was previously badge-only and was fixed.

---

## D. Prompt construction

**D15. Where is history converted into the Anthropic `messages` array?**

**Not in `prompts.js`.** In `generateReply`, `src/lib/anthropic.js:73-76`:

```js
messages: messages.map((m) => ({
  role: m.role === "assistant" ? "assistant" : "user",
  content: sanitize(m.content),
})),
```

`prompts.js` exports only `buildSystemPrompt`, which returns a string and never
touches history.

**D16. Does the mapping read `source`?**

No — only `role`. And `source` is not even available to it: the history query at
`route.js:971-976` selects `"role, content"` only. The same is true of the
dashboard path at `src/app/api/ai/reply/route.js:135`. The distinction between a
human-typed owner message and an AI-generated one is discarded at the SQL layer,
one line before the data ever reaches a prompt.

**D17. Is there a trim / slice / last-N window?**

Yes. N = 20, at `route.js:971-976`: `ORDER BY created_at DESC LIMIT 20`, then
`.reverse()` at `route.js:985`. It operates on **DB rows, before role mapping**.
Identical window in `ai/reply/route.js:133-147`.

A second, narrower window exists inside `classifyIncomingMessage`
(`anthropic.js:414-417`, `.slice(-8)`) and in `dm-intent.js:214`. Both render
history as flat text with `m.role === "assistant" ? "AI" : "Lead"` — so an
owner's manual message is labelled **"AI"** to those classifiers too.

**D18. Can the trimmed array begin with an assistant turn? Is there a guard?**

Yes, and **no guard exists anywhere in the codebase.** Three concrete ways in:

- Echo-created conversation (`route.js:465-496`): the owner's manual DM is the
  first row, `role='assistant'`.
- Native-send injection (`route.js:626-632`): inserted with `created_at =
  row.sent_at`, deliberately sorted *before* the lead's reply.
- Any thread longer than 20 messages whose 20-message window happens to open on
  an assistant turn.

I grepped for a leading-assistant guard (`shift()`, `role !== "user"` on index 0,
synthetic user turn) across `src/` and found none. The Anthropic Messages API
requires the first message to use the `user` role, so these threads are relying
on the window happening to open on a lead turn.

**D19. Are consecutive same-role messages merged, dropped, or passed through?**

Passed through as-is. `anthropic.js:73-76` is a straight `.map()` with no
adjacency logic. The incident thread contains two consecutive `assistant` rows
(the owner's two manual messages at 05:58:06 and 05:58:16).

---

## Root cause hypothesis

I found the incident thread. `conversation_id = 3d81e107-8524-4cba-af17-0cb1c1e9ed68`,
`origin='inbound'`, and at the time of the failure `ai_paused=false`,
`ai_pause_reason=NULL`, `last_skip_reason=NULL`:

| when | role | source | content |
|---|---|---|---|
| 08-09 17:11:46 | user | lead | `👋` |
| 08-09 17:12:04 | assistant | agent | "Hey, welcome! Really glad you stopped by. What brought you here today…" |
| 08-10 05:58:06 | assistant | **manual** | "Hey sorry I'm a software developer and my ai assistant try's to answer everyone to book them lol" |
| 08-10 05:58:16 | assistant | **manual** | "Happy we followed each other here" |
| 08-10 23:30:47 | user | lead | `💖` |
| 08-10 23:31:03 | assistant | agent | "Ha, that's honestly pretty funny — sounds like **your** assistant is doing its job a little too well!…" |

17 hours 33 minutes between the owner's manual message and the AI's reply, which
matches the incident report exactly.

**Two independent defects had to line up, and both are single lines.**

**Defect 1 — the AI was never stopped.** `handleEchoEvent` inserts the owner's
manual message at `src/app/api/webhooks/instagram/route.js:546-552` and does
nothing else. Its own header comment (`route.js:392-394`) states the invariant as
"this handler only persists" — which was written to prevent the agent replying to
its own echo, but has the side effect that a human takeover leaves `ai_paused`
untouched. So when `💖` arrived 17 hours later, the gate at `route.js:812` read
`ai_paused = false` and the pipeline proceeded normally.

**Defect 2 — the model could not tell who wrote what.**
`src/app/api/webhooks/instagram/route.js:973` — `.select("role, content")` — is
the specific line. It drops `source` before the history leaves the database.
`src/lib/anthropic.js:74` then collapses every `role='assistant'` row to a bare
`assistant` turn with no origin marker. The model received the owner's sentence
"my ai assistant tries to answer everyone" as an *unattributed prior assistant
turn in its own voice*, immediately followed by a bare `💖`. Having no marker
saying "a human wrote this, not you", the most coherent reading available to it
was that the assistant-in-question belonged to the other party — so it replied
"sounds like **your** assistant is doing its job a little too well".

If I have to name one line: **`route.js:973`**. Defect 1 determines *whether* the
AI speaks; `route.js:973` determines *what it believes it is reading* when it
does. Phase 2 closes the first, Phase 3 the second, and both are needed — the
same misattribution is reachable through `/api/ai/reply` (`ai/reply/route.js:135`,
identical SELECT) even with the pause in place.

**Related, same root cause.** Conversation `8f6c01da-afa8-408f-98c3-5009c43ce1d3`
produced *"I think you might have me mixed up with someone else — this is the
Clinchd inbox"* to a personal contact of the owner. `prompts.js:330` opens with
"managing Instagram DMs for **a business**" and nothing in the prompt forbids
inventing an organizational identity, so the model minted one. Phase 3 item 6
addresses this.
