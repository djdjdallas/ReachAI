-- One conversation per (user, prospect). The webhook's SELECT-then-INSERT has
-- no constraint behind it, so racing invocations (lead double-texts, or echo
-- vs inbound) create duplicate rows; maybeSingle() then errors on 2 rows, the
-- error was discarded, and every later message spawned another conversation.
-- This migration merges any existing duplicates into the oldest row, then adds
-- the unique index the code's new 23505 re-select path relies on.
--
-- Run manually. Safe to re-run (idempotent: no dupes -> no-ops, IF NOT EXISTS).

-- 1) Cancel ACTIVE drip queue rows on duplicate conversations. They can't be
--    re-parented: drip_queue_one_active_per_conversation allows one active row
--    per conversation and the keeper may already have one.
with ranked as (
  select id,
         first_value(id) over (
           partition by user_id, instagram_sender_id
           order by created_at, id
         ) as keeper_id
  from public.conversations
),
dupes as (select id from ranked where id <> keeper_id)
update public.dm_drip_queue q
set status = 'canceled',
    skip_reason = 'duplicate_conversation_merge'
where q.conversation_id in (select id from dupes)
  and q.status in ('scheduled', 'processing');

-- 2) Re-parent children of duplicates onto the keeper.
with ranked as (
  select id,
         first_value(id) over (
           partition by user_id, instagram_sender_id
           order by created_at, id
         ) as keeper_id
  from public.conversations
),
dupes as (select id, keeper_id from ranked where id <> keeper_id)
update public.messages m
set conversation_id = d.keeper_id
from dupes d
where m.conversation_id = d.id;

with ranked as (
  select id,
         first_value(id) over (
           partition by user_id, instagram_sender_id
           order by created_at, id
         ) as keeper_id
  from public.conversations
),
dupes as (select id, keeper_id from ranked where id <> keeper_id)
update public.bookings b
set conversation_id = d.keeper_id
from dupes d
where b.conversation_id = d.id;

with ranked as (
  select id,
         first_value(id) over (
           partition by user_id, instagram_sender_id
           order by created_at, id
         ) as keeper_id
  from public.conversations
),
dupes as (select id, keeper_id from ranked where id <> keeper_id)
update public.dm_drip_queue q
set conversation_id = d.keeper_id
from dupes d
where q.conversation_id = d.id;

with ranked as (
  select id,
         first_value(id) over (
           partition by user_id, instagram_sender_id
           order by created_at, id
         ) as keeper_id
  from public.conversations
),
dupes as (select id, keeper_id from ranked where id <> keeper_id)
update public.native_send_outbound n
set matched_conversation_id = d.keeper_id
from dupes d
where n.matched_conversation_id = d.id;

-- 3) Refresh the keeper's last_message_at so merged threads sort correctly.
update public.conversations c
set last_message_at = sub.max_created
from (
  select conversation_id, max(created_at) as max_created
  from public.messages
  group by conversation_id
) sub
where sub.conversation_id = c.id
  and c.last_message_at is distinct from sub.max_created
  and exists (
    select 1
    from public.conversations c2
    where c2.user_id = c.user_id
      and c2.instagram_sender_id = c.instagram_sender_id
      and c2.id <> c.id
  );

-- 4) Delete the now-childless duplicates.
with ranked as (
  select id,
         first_value(id) over (
           partition by user_id, instagram_sender_id
           order by created_at, id
         ) as keeper_id
  from public.conversations
)
delete from public.conversations c
using ranked r
where c.id = r.id
  and r.id <> r.keeper_id;

-- 5) The constraint itself.
create unique index if not exists conversations_user_sender_unique
  on public.conversations (user_id, instagram_sender_id);
