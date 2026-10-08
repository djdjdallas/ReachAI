# Outbound lifecycle webhooks

Clinchd can POST signed lifecycle events for one account (one clinic
location) to one HTTPS endpoint. This page is the contract (version `"1"`)
for anyone building the receiving side.

- Configured per account by a Clinchd admin (`scripts/outbound-webhooks.mjs`).
  There is no public API and no self-serve setup.
- Only accounts with an **enabled** webhook emit anything. Each account
  chooses which event types it receives (default: every lifecycle type).
- Delivery is at-least-once, possibly out of order. Receivers dedupe on the
  event id and order by `occurred_at`.

## Envelope

Every event has the same shape:

| Field | Type | Notes |
|---|---|---|
| `id` | string | `evt_` + UUID. Globally unique across all accounts. The same id is reused on every retry and replay. |
| `type` | string | One of the event types below. |
| `version` | string | `"1"`. |
| `occurred_at` | ISO 8601 | When the step happened in Clinchd (not when it was sent). |
| `workspace` | object | `{ "id": <Clinchd account id>, "name": <business name> }`. One workspace = one clinic location. |
| `lead` | object \| null | `null` only for `test`. See below. |
| `conversation` | object \| null | `{ "id", "trigger": null, "trigger_type": "comment" \| "dm" }`. `null` for `test`, booking-only leads and comment-only leads. |
| `data` | object | Per type; `{}` unless listed below. |

### `lead`

| Field | Notes |
|---|---|
| `id` | Stable lead id. The Clinchd conversation id (one lead = one Instagram thread per account), so it equals `conversation.id`. A Calendly booking that matched no conversation uses `bkg_<booking id>`. A comment handed to a person before any DM thread existed (`handoff_requested` only) uses `cmt_<comment id>`; if that person later gets a DM thread, it is a new lead id. |
| `instagram_username` | When known. |
| `first_name`, `last_name` | Only from a Calendly booking (the invitee's name), and only when the booking matched the lead by email or is a booking-only lead. Never guessed from Instagram display names. |
| `email` | Validated format, lowercased. |
| `phone` | E.164 (`+15125550123`). US is the default country; ambiguous numbers are dropped, never sent half-parsed. |
| `treatment_interest` | A short category **key** from the account's configured service list (for example `botox`, `lip_filler`; max 40 chars, `a-z 0-9 _ -`). Never the lead's words. |
| `source` | `instagram_comment` or `instagram_dm`. |

**Omitted means unchanged.** Clinchd omits any lead field it doesn't have
(or can't validate). Never clear a stored value because a field is missing.
Contact fields can arrive in a later event than the lead was created in.

**Never included:** message text or transcripts, medical history or
conditions, medications, pregnancy, diagnoses, insurance, images, or the
reason text behind a handoff.

`trigger` is always `null` in version 1 (Clinchd classifies comments rather
than matching a keyword). `trigger_type` is `comment` for a lead who came in
through a comment and `dm` for one who messaged first.

## Event types

| Type | When it fires | Fires |
|---|---|---|
| `new_inquiry` | A new lead thread is created: a comment that got a DM, or an inbound-first DM. A thread the clinic itself cold-DM'd is not an inquiry. | once per lead |
| `dm_started` | The first message Clinchd sent to the lead was actually delivered by Instagram. | once per lead |
| `contact_captured` | The lead typed a valid email or phone (in a DM, or in the comment that started the thread). | once per distinct value (max 6 per lead) |
| `booking_link_sent` | A delivered message contained the account's booking link. | once per lead |
| `consultation_booked` | A real Calendly booking was recorded (or a demo booking on a demo account). | once per booking |
| `follow_up_sent` | A follow-up nudge was delivered. | once per nudge |
| `handoff_requested` | The lead was handed to a person and the assistant paused, or a comment on a watched post needs a person and got no DM. | once per pause, or once per comment |
| `lead_updated` | A lead field was filled in without a lifecycle step: today, the lead's `treatment_interest` was first recognized. No stage meaning; update the lead and nothing else. | once per lead per treatment key |
| `test` | Sent by a Clinchd admin to check the connection. | on demand |

### `new_inquiry`

```json
{
  "id": "evt_0b9e2f1c-3d4a-4b5c-8d6e-7f8091a2b3c4",
  "type": "new_inquiry",
  "version": "1",
  "occurred_at": "2026-10-06T15:00:00.000Z",
  "workspace": {
    "id": "5e1f0c3a-2b7d-4c1e-9a55-0d6f3b8e2a11",
    "name": "Solé Aesthetics"
  },
  "lead": {
    "id": "8c2d4e6f-1a3b-4c5d-8e9f-0a1b2c3d4e5f",
    "instagram_username": "jane.doe.glow",
    "treatment_interest": "botox",
    "source": "instagram_comment"
  },
  "conversation": {
    "id": "8c2d4e6f-1a3b-4c5d-8e9f-0a1b2c3d4e5f",
    "trigger": null,
    "trigger_type": "comment"
  },
  "data": {}
}
```

### `dm_started`

```json
{
  "id": "evt_1c0f3a2d-4e5b-4c6d-9e7f-8091a2b3c4d5",
  "type": "dm_started",
  "version": "1",
  "occurred_at": "2026-10-06T15:00:01.000Z",
  "workspace": {
    "id": "5e1f0c3a-2b7d-4c1e-9a55-0d6f3b8e2a11",
    "name": "Solé Aesthetics"
  },
  "lead": {
    "id": "8c2d4e6f-1a3b-4c5d-8e9f-0a1b2c3d4e5f",
    "instagram_username": "jane.doe.glow",
    "treatment_interest": "botox",
    "source": "instagram_comment"
  },
  "conversation": {
    "id": "8c2d4e6f-1a3b-4c5d-8e9f-0a1b2c3d4e5f",
    "trigger": null,
    "trigger_type": "comment"
  },
  "data": {}
}
```

### `contact_captured`

```json
{
  "id": "evt_2d1a4b3e-5f6c-4d7e-8f80-91a2b3c4d5e6",
  "type": "contact_captured",
  "version": "1",
  "occurred_at": "2026-10-06T15:04:12.000Z",
  "workspace": {
    "id": "5e1f0c3a-2b7d-4c1e-9a55-0d6f3b8e2a11",
    "name": "Solé Aesthetics"
  },
  "lead": {
    "id": "8c2d4e6f-1a3b-4c5d-8e9f-0a1b2c3d4e5f",
    "instagram_username": "jane.doe.glow",
    "email": "jane.doe@example.com",
    "phone": "+15125550123",
    "treatment_interest": "botox",
    "source": "instagram_comment"
  },
  "conversation": {
    "id": "8c2d4e6f-1a3b-4c5d-8e9f-0a1b2c3d4e5f",
    "trigger": null,
    "trigger_type": "comment"
  },
  "data": {}
}
```

### `booking_link_sent`

```json
{
  "id": "evt_3e2b5c4f-6a7d-4e8f-9091-a2b3c4d5e6f7",
  "type": "booking_link_sent",
  "version": "1",
  "occurred_at": "2026-10-06T15:04:40.000Z",
  "workspace": {
    "id": "5e1f0c3a-2b7d-4c1e-9a55-0d6f3b8e2a11",
    "name": "Solé Aesthetics"
  },
  "lead": {
    "id": "8c2d4e6f-1a3b-4c5d-8e9f-0a1b2c3d4e5f",
    "instagram_username": "jane.doe.glow",
    "email": "jane.doe@example.com",
    "phone": "+15125550123",
    "treatment_interest": "botox",
    "source": "instagram_comment"
  },
  "conversation": {
    "id": "8c2d4e6f-1a3b-4c5d-8e9f-0a1b2c3d4e5f",
    "trigger": null,
    "trigger_type": "comment"
  },
  "data": {}
}
```

### `consultation_booked`

`data.scheduled_for` is the appointment start (ISO 8601) or `null`.
`first_name` / `last_name` come from the Calendly invitee, and are sent only
when the booking matched the lead by email (as here) or is a booking-only lead.

```json
{
  "id": "evt_4f3c6d5a-7b8e-4f90-a1b2-c3d4e5f6a7b8",
  "type": "consultation_booked",
  "version": "1",
  "occurred_at": "2026-10-06T15:20:03.000Z",
  "workspace": {
    "id": "5e1f0c3a-2b7d-4c1e-9a55-0d6f3b8e2a11",
    "name": "Solé Aesthetics"
  },
  "lead": {
    "id": "8c2d4e6f-1a3b-4c5d-8e9f-0a1b2c3d4e5f",
    "instagram_username": "jane.doe.glow",
    "first_name": "Jane",
    "last_name": "Doe",
    "email": "jane.doe@example.com",
    "phone": "+15125550123",
    "treatment_interest": "botox",
    "source": "instagram_comment"
  },
  "conversation": {
    "id": "8c2d4e6f-1a3b-4c5d-8e9f-0a1b2c3d4e5f",
    "trigger": null,
    "trigger_type": "comment"
  },
  "data": {
    "scheduled_for": "2026-10-09T17:00:00.000Z"
  }
}
```

The booking is linked to a lead first by the invitee's email (if the lead
typed it in the DMs), otherwise by an exact full-name match (case-insensitive,
whitespace collapsed) when exactly one lead has that name. A name match sends
no invitee name or email. If no lead matches, or more than one does, the
booking arrives as a **booking-only lead** with the invitee's name and email
and no conversation:

```json
{
  "id": "evt_4f3c6d5a-7b8e-4f90-a1b2-c3d4e5f6a7b8",
  "type": "consultation_booked",
  "version": "1",
  "occurred_at": "2026-10-06T15:20:03.000Z",
  "workspace": {
    "id": "5e1f0c3a-2b7d-4c1e-9a55-0d6f3b8e2a11",
    "name": "Solé Aesthetics"
  },
  "lead": {
    "id": "bkg_b7a1c2d3-e4f5-4a6b-8c7d-9e0f1a2b3c4d",
    "first_name": "Jane",
    "last_name": "Doe",
    "email": "jane.doe@example.com"
  },
  "conversation": null,
  "data": {
    "scheduled_for": "2026-10-09T17:00:00.000Z"
  }
}
```

Demo accounts (used for sales demos, never a real clinic) send
`"demo": true`; real bookings never carry the key:

```json
{
  "id": "evt_4f3c6d5a-7b8e-4f90-a1b2-c3d4e5f6a7b8",
  "type": "consultation_booked",
  "version": "1",
  "occurred_at": "2026-10-06T15:20:03.000Z",
  "workspace": {
    "id": "5e1f0c3a-2b7d-4c1e-9a55-0d6f3b8e2a11",
    "name": "Solé Aesthetics"
  },
  "lead": {
    "id": "8c2d4e6f-1a3b-4c5d-8e9f-0a1b2c3d4e5f",
    "instagram_username": "jane.doe.glow",
    "first_name": "Jane",
    "last_name": "Doe",
    "email": "jane.doe@example.com",
    "phone": "+15125550123",
    "treatment_interest": "botox",
    "source": "instagram_comment"
  },
  "conversation": {
    "id": "8c2d4e6f-1a3b-4c5d-8e9f-0a1b2c3d4e5f",
    "trigger": null,
    "trigger_type": "comment"
  },
  "data": {
    "scheduled_for": "2026-10-09T17:00:00.000Z",
    "demo": true
  }
}
```

### `follow_up_sent`

```json
{
  "id": "evt_5a4d7e6b-8c9f-4a01-b2c3-d4e5f6a7b8c9",
  "type": "follow_up_sent",
  "version": "1",
  "occurred_at": "2026-10-07T14:00:00.000Z",
  "workspace": {
    "id": "5e1f0c3a-2b7d-4c1e-9a55-0d6f3b8e2a11",
    "name": "Solé Aesthetics"
  },
  "lead": {
    "id": "8c2d4e6f-1a3b-4c5d-8e9f-0a1b2c3d4e5f",
    "instagram_username": "jane.doe.glow",
    "email": "jane.doe@example.com",
    "treatment_interest": "botox",
    "source": "instagram_dm"
  },
  "conversation": {
    "id": "8c2d4e6f-1a3b-4c5d-8e9f-0a1b2c3d4e5f",
    "trigger": null,
    "trigger_type": "dm"
  },
  "data": {}
}
```

### `handoff_requested`

`data.reason` is one of `medical_question`, `missing_knowledge`,
`human_requested`, `other`. Never the message text. `human_requested` is
reserved: nothing produces it in version 1.

| Clinchd pause | `reason` |
|---|---|
| Medical or health question | `medical_question` |
| A price, availability or policy question the clinic's knowledge doesn't answer | `missing_knowledge` |
| Complex objection, stuck conversation, hostile or refund request, crisis signal | `other` |
| A comment on a watched post that got no DM and needs a person: a complaint (bad outcome, side effect, refund), or a possible inquiry the assistant couldn't DM (not confident enough, or no template). Praise and fan comments never hand off. Nothing is paused. | `other` |
| Staff replied by hand, or a silent safety pause | no event |

```json
{
  "id": "evt_6b5e8f7c-9d0a-4b12-c3d4-e5f6a7b8c9d0",
  "type": "handoff_requested",
  "version": "1",
  "occurred_at": "2026-10-06T15:06:30.000Z",
  "workspace": {
    "id": "5e1f0c3a-2b7d-4c1e-9a55-0d6f3b8e2a11",
    "name": "Solé Aesthetics"
  },
  "lead": {
    "id": "8c2d4e6f-1a3b-4c5d-8e9f-0a1b2c3d4e5f",
    "instagram_username": "jane.doe.glow",
    "email": "jane.doe@example.com",
    "phone": "+15125550123",
    "treatment_interest": "botox",
    "source": "instagram_comment"
  },
  "conversation": {
    "id": "8c2d4e6f-1a3b-4c5d-8e9f-0a1b2c3d4e5f",
    "trigger": null,
    "trigger_type": "comment"
  },
  "data": {
    "reason": "medical_question"
  }
}
```

A comment from someone with no DM thread yet arrives as a **comment-only
lead**: `lead.id` is `cmt_<comment id>`, the only other lead fields are
`instagram_username` and `source`, and `conversation` is `null`.

```json
{
  "lead": {
    "id": "cmt_3f2a1b0c-9d8e-4f7a-8b6c-5d4e3f2a1b0c",
    "instagram_username": "jane.doe.glow",
    "source": "instagram_comment"
  },
  "conversation": null,
  "data": { "reason": "other" }
}
```

### `lead_updated`

The lead's details changed, with no step in the funnel. Fires when
`treatment_interest` goes from unknown to a category key, for example when a
lead who already exists says "I'm interested in botox". Update the stored
lead from `lead`; don't move it to a new stage. `data` is `{}`.

```json
{
  "id": "evt_7c6f9a8d-0e1b-4c23-d4e5-f6a7b8c9d0e1",
  "type": "lead_updated",
  "version": "1",
  "occurred_at": "2026-10-06T15:03:40.000Z",
  "workspace": {
    "id": "5e1f0c3a-2b7d-4c1e-9a55-0d6f3b8e2a11",
    "name": "Solé Aesthetics"
  },
  "lead": {
    "id": "8c2d4e6f-1a3b-4c5d-8e9f-0a1b2c3d4e5f",
    "instagram_username": "jane.doe.glow",
    "treatment_interest": "botox",
    "source": "instagram_dm"
  },
  "conversation": {
    "id": "8c2d4e6f-1a3b-4c5d-8e9f-0a1b2c3d4e5f",
    "trigger": null,
    "trigger_type": "dm"
  },
  "data": {}
}
```

### `test`

```json
{
  "id": "evt_7c6f9a8d-0e1b-4c23-d4e5-f6a7b8c9d0e1",
  "type": "test",
  "version": "1",
  "occurred_at": "2026-10-06T14:55:00.000Z",
  "workspace": {
    "id": "5e1f0c3a-2b7d-4c1e-9a55-0d6f3b8e2a11",
    "name": "Solé Aesthetics"
  },
  "lead": null,
  "conversation": null,
  "data": {}
}
```

## Headers and signing

| Header | Value |
|---|---|
| `Content-Type` | `application/json` |
| `X-Clinchd-Event` | the event type |
| `X-Clinchd-Event-Id` | the event id (same as `id` in the body) |
| `X-Clinchd-Timestamp` | unix seconds when this attempt was signed |
| `X-Clinchd-Signature` | `v1=` + hex HMAC-SHA256 of `<timestamp>.<raw body>` with the signing secret |

Every attempt is signed fresh: a retry has the same body bytes and event id
but a new timestamp and signature.

Receiver rules:

1. Verify the signature over the **raw request bytes**, before parsing JSON,
   with a constant-time compare.
2. Reject timestamps more than 5 minutes from your clock.
3. Dedupe on the event id (a unique key in your database), and return 2xx
   for a duplicate.
4. Tolerate out-of-order delivery: upsert leads by `lead.id`, only overwrite
   fields that are present, and order steps by `occurred_at`.
5. Return 2xx quickly (within 10 seconds) and do slow work afterwards.

Each workspace has its own signing secret. One receiver URL can serve many
workspaces: either give each workspace its own URL (for example a query
parameter Clinchd stores as part of the endpoint), or read `workspace.id`
from the unverified body only to choose which secret to verify with, and
trust nothing else in the body until the signature checks out.

### Node receiver example (no dependencies)

```js
// Minimal Clinchd webhook receiver (Node 18+, no dependencies).
import http from "node:http";
import crypto from "node:crypto";

const SECRET = process.env.CLINCHD_WEBHOOK_SECRET;
const TOLERANCE_SEC = 5 * 60;
const seen = new Set(); // use a database unique key in production

function verify(rawBody, headers) {
  const ts = Number(headers["x-clinchd-timestamp"]);
  const sig = String(headers["x-clinchd-signature"] || "");
  if (!Number.isInteger(ts) || Math.abs(Date.now() / 1000 - ts) > TOLERANCE_SEC) return false;
  const expected = "v1=" + crypto.createHmac("sha256", SECRET).update(`${ts}.`).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

http
  .createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks); // verify the raw bytes, before JSON.parse
      if (!verify(raw, req.headers)) {
        res.writeHead(401).end("bad signature");
        return;
      }
      const event = JSON.parse(raw.toString("utf8"));
      if (seen.has(event.id)) {
        res.writeHead(200).end("duplicate");
        return;
      }
      seen.add(event.id);
      // Out-of-order safe: upsert the lead by event.lead.id, only overwrite
      // fields present in the payload, and use occurred_at to order steps.
      console.log(event.type, event.id, event.lead?.id ?? "-", JSON.stringify(event.data));
      res.writeHead(200).end("ok");
    });
  })
  .listen(Number(process.env.PORT || 4010));
```

In a Next.js route handler, read the raw body with `await request.text()`
and verify that string before calling `JSON.parse`.

## Delivery and retries

- Events are written to an outbox in the same database transaction as the
  step that caused them, and a cron delivers them. Clinchd never calls the
  receiver from inside a DM, so a slow or failing receiver can't delay or
  break a conversation.
- First attempt: within about a minute of the step. Then retries after about
  1 minute, 5 minutes, 30 minutes and 2 hours (each ±20% jitter): 5 attempts
  in all, then the event is marked failed. A Clinchd admin can replay any
  event by id (same id, same body, fresh signature) for 30 days.
- Retried: network errors, timeouts, DNS failures, `408`, `425`, `429` and
  `5xx`. Not retried (failed at once, replayable): other `4xx`, any `3xx`
  (redirects are never followed).
- Timeout: 10 seconds per attempt. At most 4 KB of the response body is read.
- The endpoint must be `https://` on port 443, and its hostname must resolve
  only to public addresses. This is checked when the endpoint is configured
  and again on every attempt.

## Retention

The body of each event is kept for 30 days after it is delivered or fails,
then deleted. The delivery record (event id, type, attempts, last HTTP
status, destination host, timestamps) is kept.

## Limitations (version 1)

- One endpoint per account.
- Secret rotation takes effect immediately, with no overlap window: rotate
  the secret in Clinchd and update the receiver together.
- `trigger` is always `null`; there are no keyword triggers.
- `first_name` / `last_name` only come from Calendly bookings matched by
  email, or booking-only leads.
- Booking-to-lead matching uses the invitee's email (if the lead typed it in
  the DMs), then an exact full-name match. A name match can still be wrong
  when two people share a name and only one of them has a thread; it then
  carries no invitee name or email. Bookings made outside Calendly (other
  schedulers) produce no `consultation_booked`.
- `booking_link_sent` matches the account's booking link (or Calendly link)
  in the message text. A shortened or reworded link won't match.
- A lead's email or phone is taken only when a message (or the comment that
  started the thread) contains exactly one of them. A correction produces a
  new `contact_captured` with the new value (up to 6 per lead).
- `treatment_interest` is set once per lead (the first recognized
  category) and `lead_updated` fires for it. A lead who later mentions a
  different treatment keeps the first key. If the same step that captured the
  treatment also captured an email or phone, `contact_captured` and
  `lead_updated` both arrive, carrying the same lead fields.
- Webhooks created before `lead_updated` existed don't receive it until an
  admin adds it to their event list.
- No `consultation_canceled` / `rescheduled` events. A reschedule in
  Calendly creates a new booking, so it arrives as a new
  `consultation_booked`.
- `dm_started` counts only messages Clinchd sent, not ones staff typed by
  hand in Instagram.
- If a webhook is disabled, events already queued fail with
  `webhook_disabled` (replayable) and new steps emit nothing.

## Testing a receiver

`scripts/send-sample-webhooks.mjs` sends a correctly signed sample of every
event type to any URL (http and localhost allowed; it's a local tool):

```bash
node --import ./scripts/_ext-loader.mjs scripts/send-sample-webhooks.mjs \
  --url http://localhost:3000/api/ingest/clinchd --secret whsec_... \
  --duplicate --reverse --stale --bad-signature
```

`--duplicate` resends each event (same id, fresh signature), `--reverse`
sends them out of order, and `--stale` / `--bad-signature` each send one
event the receiver must reject.

## For Clinchd admins

- Setup and operations: `docs/runbooks/managed-clinic-setup.md`.
- Code: `src/lib/outbound-webhooks/`, cron `/api/cron/outbound-webhooks`
  (every minute), migration `20261009120000_outbound_webhooks.sql`.
- Emit failures (a trigger that couldn't write the outbox; the DM itself
  still succeeds) are logged by the cron as `[outbound-webhooks] emit
  failure` and listed by `scripts/outbound-webhooks.mjs show`.
