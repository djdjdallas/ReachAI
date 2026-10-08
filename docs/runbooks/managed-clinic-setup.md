# Runbook: managed clinic accounts and outbound webhooks

How to set up (A) the Solé Aesthetics demo account and (B) a real clinic
location end to end: a managed (not Stripe-billed) Clinchd account with a
named AI assistant, sending signed lifecycle webhooks to the receiver at
`https://app.mararue.com/api/ingest/clinchd`.

Contract for the receiving side: `docs/outbound-webhooks.md`.

Rules that hold for every account set up this way:

- One clinic location = one Clinchd account (one login, one Instagram
  account, one webhook, one signing secret).
- The account is billed outside Clinchd. It must never go through Stripe
  Checkout; `billing_managed` gives it access without a subscription, and
  /billing shows "Managed plan" with no price or buttons.
- The assistant name is the name of an AI assistant. It still says it's an
  AI in its first sentence whenever someone asks, and never claims to be a
  person or a member of staff.
- The first message a lead receives in a thread (the comment-to-DM opener,
  the first reply to a DM, or a follow-up if nothing else went out) starts
  with "Hi! I'm Katlynne, Solé Aesthetics' AI concierge." The server adds
  it, and drops a leading "Hey!" / "Hi!" / "Hey there!" from the template so
  there's no double greeting. Don't write a disclosure into templates. It
  never repeats in the same thread.

## 0. One-time: the migration

Before the first deploy of this feature, run
`supabase/migrations/20261009120000_outbound_webhooks.sql` in the Supabase
SQL editor (prod). It sets `lock_timeout = '3s'`: if a busy table makes it
stop with "canceling statement due to lock timeout", run it again (ideally at
a quiet moment). Statements before the timeout may already have applied;
that's fine, every statement in it is re-runnable.

## 0b. One-time: your machine

The admin scripts run locally with production credentials:

```bash
vercel env pull .env.production.local --environment=production
# needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ENCRYPTION_KEY
```

`ENCRYPTION_KEY` must be production's. The webhook secret is encrypted with
it locally, and production must be able to decrypt it. If they differ, the
first test event fails with `secret_unreadable` (step 6 catches this).

Shorthand used below:

```bash
alias cadmin='node --env-file=.env.production.local --import ./scripts/_ext-loader.mjs'
```

Every write command is a dry run without `--apply`. Read what it prints
before adding `--apply`.

## A. Solé Aesthetics demo account

A Clinchd account you control, connected to a demo Instagram Business
account, used to show the flow on calls. It is flagged `webhook_demo`, so
you can record demo bookings (sent with `data.demo = true`) without a real
Calendly booking.

1. **Create the login.** Sign up at https://clinchd.io/signup with an email
   you control for the demo (for example `dom+sole-demo@clinchd.io`). Stop at
   the plan page; don't start Checkout.

2. **Make it managed, set the persona, turn on the demo flag:**

   ```bash
   cadmin scripts/managed-account.mjs --user dom+sole-demo@clinchd.io \
     --managed true --plan unlimited \
     --business-name "Solé Aesthetics" --assistant-name "Katlynne" \
     --holding-text "Great question! Let me check with the team and get right back to you." \
     --treatments '[{"key":"botox","match":["botox","tox","dysport","xeomin","wrinkle relaxer"]},{"key":"lip_filler","match":["lip filler","lips","lip flip"]},{"key":"dermal_filler","match":["filler","cheek filler","jawline"]},{"key":"hydrafacial","match":["hydrafacial","facial"]},{"key":"laser_hair_removal","match":["laser hair removal","laser"]}]' \
     --demo true
   # read the dry run, then add --apply
   ```

   Reload the app: the plan page lets you through, and /billing shows
   "Managed plan".

   The holding text above is an example. The script rejects anything with
   em dashes, markdown, placeholders, or a claim to be a person.

3. **Connect Instagram** (Settings, Connect Instagram) with the demo
   Instagram Business account.

4. **Set up the conversation** in the dashboard, logged in as the demo
   account:
   - Script: offer, target customer, greeting (the AI can't go live without
     a greeting).
   - Settings, Business knowledge: start from the med spa template and fill
     in real-looking hours, services, prices-at-consultation, consultation
     policy.
   - Booking link: paste the demo scheduling link into the booking link
     field. If the demo uses a non-Calendly scheduler, also set
     `--booking-url https://...` (step 2 script) so `booking_link_sent` fires.
   - Comment-to-DM: enable it on the demo post and write the HIGH_INTENT
     template (no disclosure in it; see the rules at the top).
   - Follow-ups (drips): turn on if you want to show them.
   - Turn the AI on.

5. **Create the webhook** (disabled first):

   ```bash
   cadmin scripts/outbound-webhooks.mjs create --user dom+sole-demo@clinchd.io \
     --url "https://app.mararue.com/api/ingest/clinchd" --apply
   ```

   It prints the signing secret **once**. Put it straight into the Mara Rue
   dashboard's config for this workspace, keyed by the `workspace.id` (the
   Clinchd user id the command printed as `user_id`). Don't paste it
   anywhere else. If it's lost, run `rotate` (step 9).

6. **Enable and test:**

   ```bash
   cadmin scripts/outbound-webhooks.mjs enable --user dom+sole-demo@clinchd.io --apply
   cadmin scripts/outbound-webhooks.mjs test   --user dom+sole-demo@clinchd.io --apply
   # wait about a minute, then
   cadmin scripts/outbound-webhooks.mjs show   --user dom+sole-demo@clinchd.io
   ```

   The test event should show `status: delivered, last_status: 200`.
   - `secret_unreadable`: your local `ENCRYPTION_KEY` isn't production's.
     Pull the env again, then `rotate` and update the receiver.
   - `http_401`: the receiver has a different secret, or its clock is off by
     more than 5 minutes.
   - `address_blocked` / `dns_failed`: the receiver host doesn't resolve to a
     public address.

7. **Run the demo flow** from a separate Instagram account:
   - Comment the trigger on the demo post → a DM starting "Hi! I'm Katlynne,
     Solé Aesthetics' AI concierge." followed by the template, plus
     `new_inquiry` and `dm_started` (`trigger_type: comment`,
     `treatment_interest` if the comment names a treatment). The next replies
     carry no disclosure and no greeting.
   - Reply with an email and phone → `contact_captured`.
   - Ask "do you have openings this week?" → the booking link in that reply,
     and `booking_link_sent`.
   - Ask "is botox safe while breastfeeding?" → holding text, thread paused,
     `handoff_requested` with `reason: medical_question`. Unpause from the
     inbox afterwards.
   - Ask "are you a real person?" → "I'm Katlynne, Solé Aesthetics' AI
     concierge, not a real person. The team can jump in when needed..."
     (no event).

8. **Demo booking** (instead of a real Calendly booking). Find the demo
   lead's conversation id in the inbox URL or with `show`, then:

   ```bash
   cadmin scripts/managed-account.mjs --user dom+sole-demo@clinchd.io \
     --demo-booking <conversation id> --apply
   ```

   This emits `consultation_booked` with `data.demo = true`, scheduled two
   days out. Without a conversation id it arrives as a booking-only lead.

9. **Rotate the secret** (lost or exposed): update both sides together. The
   old secret stops working on the next attempt, and events in flight retry
   with the new one.

   ```bash
   cadmin scripts/outbound-webhooks.mjs rotate --user dom+sole-demo@clinchd.io --apply
   ```

## B. A real clinic location

Same steps as A, with these differences:

1. **Login:** sign up with the location's email (or one you control and hand
   over later). One location per account; a second location is a second
   signup.

2. **Managed + persona:** as A.2, with the clinic's real business name,
   holding text and treatment list, and **without** `--demo true`. Never
   set `webhook_demo` on a real clinic: demo bookings would reach the
   dashboard as bookings.

3. **Instagram:** connect the clinic's own Instagram Business account. Do it
   on a call with someone who can log in to it.

4. **Calendly:** Settings, Connect Calendly, with the clinic's Calendly
   account. `consultation_booked` only fires for bookings that come in
   through the connected Calendly (not a pasted link alone). If the clinic
   books through another scheduler, set `--booking-url` so
   `booking_link_sent` still fires; there is no `consultation_booked` for
   other schedulers in version 1.

5. **Knowledge:** fill Business knowledge with the clinic's real answers
   (hours, address, services, consultation policy, cancellation policy).
   Medical questions are always handed to the clinic, whatever the knowledge
   says.

6. **Webhook:** `create`, put the secret in the receiver for this workspace,
   `enable`, `test`, `show` (as A.5–A.6).

7. **First real lead:** watch `show` for the first `new_inquiry` /
   `dm_started` and the cron logs (`[cron/outbound-webhooks]`) for errors.

## Operations

| Task | Command |
|---|---|
| See config and recent deliveries | `cadmin scripts/outbound-webhooks.mjs show --user <email>` |
| Pause sending (events stop being created) | `... disable --user <email> --apply` |
| Change which events are sent | `... events --user <email> --events new_inquiry,consultation_booked --apply` |
| Move the endpoint | `... set-url --user <email> --url https://... --apply` |
| Re-send one event (same id, same body) | `... replay --event evt_<uuid> --apply` |
| End a managed contract | `cadmin scripts/managed-account.mjs --user <email> --managed false --apply` then `outbound-webhooks.mjs disable` |

- **Changing events replaces the whole list.** `events` sets exactly the
  types you pass, so list every type the account should keep.
- **Adding `lead_updated` to an existing webhook** (webhooks created before
  migration `20261010120000_outbound_lead_updated.sql` don't have it; new
  ones get it by default). Run only after that migration is applied, or the
  database rejects the type. For the Solé demo account:

  ```bash
  cadmin scripts/outbound-webhooks.mjs events --user e1f2fb2c-1487-49fa-bb30-9bb8706f0281 \
    --events new_inquiry,dm_started,contact_captured,booking_link_sent,consultation_booked,follow_up_sent,handoff_requested,lead_updated
  # read the dry run, then add --apply; confirm with show
  ```

  Check `show` first: if the account was set up with a narrower list, keep
  that list and append `lead_updated`.
- **Emit failures:** if a database trigger couldn't write the outbox, the
  DM still goes through and the failure is recorded. The cron logs
  `[outbound-webhooks] emit failure` with the account and SQL error code,
  and `show` lists recent ones. Investigate any.
- **Retention:** event bodies are deleted 30 days after delivery or failure.
  Replay works only within that window.
- **Ending a contract:** with `--managed false` the account falls back to
  normal access rules: no subscription means no access. The assistant stops
  replying and leads' messages are still saved.
