# Drip Sequences v1 — Meta App Review notes

Drip Sequences ("Follow-up Nudges") sends a single follow-up DM to a lead who
goes quiet mid-conversation, **strictly inside Instagram's 24-hour messaging
window**. This document explains why the feature requires no new Meta surface
and how it respects the 24-hour rule, plus the SQL levers for the
comment-to-DM review window.

## No new Meta permissions

Drip sends use the same `instagram_business_manage_messages` permission already
used by the live AI reply path, via the same sender helper
(`sendInstagramMessage` in `src/lib/instagram.js`). It does **not**:

- request any new Meta permission,
- use the `human_agent` message tag (it never sends outside 24 hours),
- modify the comment-to-DM flow (currently in App Review, submitted 2026-05-20),
- introduce any new outbound message type.

It deploys **dark**: `users.drip_enabled` defaults to `false` for every user,
including the founder. The `/drip-sequences` page and nav link render, but no
nudge is scheduled or sent until a coach explicitly turns it on. Reviewers see
no behavior change.

## The 24-hour rule and how this feature respects it

Instagram Messaging only allows messaging within 24 hours of a user's last
inbound message. This feature operates entirely inside that window, enforced at
three layers:

1. **`drip_delay_hours` CHECK (6–22)** — it is impossible to schedule a nudge
   later than 22 hours after the lead's last message.
2. **Default delay (18h)** — leaves a 6-hour buffer before window expiry.
3. **Processor 23.5h safety check** — at fire time, if the lead's last inbound
   is ≥ 23.5 hours old, the drip is marked `expired` and never sent. This is a
   30-minute hard buffer against any clock skew or cron lag.

In addition, the processor re-verifies **8 conditions** at fire time (not just
at schedule time), because state changes constantly between schedule and fire:
master toggle still on, plan still Unlimited, conversation not paused / not
terminal, most recent message is from the AI (lead hasn't replied), a lead
message exists, inside the 24h window, lead's last intent is not `do_not_send`,
template still active, and IG still connected.

## During the comment-to-DM review window

Drip must fire for **zero** conversations on the review test account. Because it
deploys dark, this holds by default. Verify anyway:

```sql
-- Should always return 0 rows during the review window:
SELECT * FROM dm_drip_queue
WHERE user_id = (SELECT id FROM users WHERE email = 'highflyinnick@gmail.com');
```

```sql
-- Confirm no account has opted in:
SELECT email FROM users WHERE drip_enabled = true;   -- expect 0 rows
```

## Emergency global disable

```sql
UPDATE public.users SET drip_enabled = false;
```

This stops all scheduling immediately (webhook Insertion C checks
`drip_enabled`) and all firing (processor Condition 1 re-checks it). Already-
scheduled rows simply skip with `skip_reason = 'user_drip_disabled'` on their
next cron pass.

## Re-enable steps after approval

1. Confirm comment-to-DM is approved.
2. Remove the deploy-dark preview banner in
   `src/app/(dashboard)/drip-sequences/DripSequencesClient.jsx`.
3. Add the in-window follow-up bullet to the pricing page Unlimited tier.
4. Coaches opt in per-account via the master toggle on `/drip-sequences`.
   (Upgrades back to Unlimited do **not** auto-re-enable — same as Voice
   Replies; it's a deliberate manual step.)
