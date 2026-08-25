-- The Base plan sells "1,500 qualified conversations per month", but
-- increment_dm_count fired once per inbound MESSAGE (and once per dashboard
-- send) — a normal 20-message thread burned 20 slots, capping paying
-- customers after ~75 real conversations.
--
-- The code now meters conversations: each conversation increments the user's
-- monthly counter once per calendar month, stamped here. Additive column —
-- safe to run before the code deploys. Run manually.

alter table public.conversations
  add column if not exists dm_counted_at timestamptz;

comment on column public.conversations.dm_counted_at is
  'Last time this conversation was counted against the owner''s monthly conversation cap. Counted at most once per calendar month.';
