-- 20260718120000_conversation_status_new.sql
--
-- Adds a neutral 'new' value to conversations.status and makes it the
-- column default. A conversation is now born 'new' (untriaged) and only
-- becomes 'qualifying' / 'interested' / 'not_a_fit' when the first-message
-- intent classifier (or the founder) says so — previously every thread was
-- born 'qualifying', which the dashboard renders as WARM LEAD, so noise
-- threads read as warm leads forever.
--
-- ORDERING: run this migration manually BEFORE deploying the code that
-- writes 'new'. The old code writes 'qualifying' explicitly on insert,
-- which still satisfies the widened CHECK, so migration-before-code is
-- safe. Deploying code first would fail: 'new' violates the old CHECK.
--
-- SELF-GUARDING: a legacy 'not a fit' (with space) value may exist in
-- production. Re-adding the CHECK validates existing rows, so step 1
-- aborts loudly (nothing half-applied) instead of failing mid-way.

-- 1. Abort loudly if any existing status value would violate the new CHECK
do $$
declare bad_count int;
begin
  select count(*) into bad_count
  from public.conversations
  where status is not null
    and status not in ('new', 'qualifying', 'interested', 'booked', 'not_a_fit', 'manual');
  if bad_count > 0 then
    raise exception 'Aborting: % row(s) hold a status value outside the new CHECK set. Run: select distinct status from public.conversations; normalize (e.g. ''not a fit'' -> ''not_a_fit'') then retry.', bad_count;
  end if;
end $$;

-- 2. Widen the CHECK to include the neutral value
alter table public.conversations drop constraint if exists conversations_status_check;
alter table public.conversations add constraint conversations_status_check
  check (status in ('new', 'qualifying', 'interested', 'booked', 'not_a_fit', 'manual'));

-- 3. Neutral default
alter table public.conversations alter column status set default 'new';
