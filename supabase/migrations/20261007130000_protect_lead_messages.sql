-- Browser writes can't forge lead messages or the DM meter (audit M1, L7).
--
-- Run before or with the deploy; no code depends on it. Safe to run any
-- time: the app writes these tables only with the service role, which the
-- triggers do not restrict.
--
-- messages: RLS lets a signed-in coach insert into their own conversations
-- (policy "Users can insert messages to own conversations"). Without a
-- check, a coach (or a script holding their session) could insert a row
-- with role='user', source='lead': a message the lead never sent. That
-- reopens Instagram's 24h window as the app computes it (the window is
-- measured from the lead's last inbound message), feeds the AI words the
-- lead never said, and can be backdated with an explicit created_at.
--
-- Browser roles (anon, authenticated) may still insert the shape a coach's
-- own manual message has: role 'assistant', any non-lead source, no
-- created_at (the column default stamps it). The inbox send today goes
-- through /api/ai/reply with the service role; this keeps a direct
-- browser insert of that shape working too.
--
-- conversations.dm_counted_at: the monthly DM meter (a conversation counts
-- once per calendar month). The browser can update its own conversations,
-- so it could clear or future-date this column to dodge the cap. Only the
-- server writes it.
--
-- Same role detection as protect_billing_columns: the JWT role PostgREST
-- sets for the request. Service role and direct SQL pass through.

create or replace function public.protect_lead_messages()
returns trigger
language plpgsql
as $$
declare
  jwt_role text := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    current_setting('request.jwt.claim.role', true)
  );
begin
  if jwt_role is null or jwt_role not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.role = 'user' or new.source = 'lead' then
    raise exception 'lead messages are written by the server only'
      using errcode = '42501'; -- insufficient_privilege
  end if;

  if tg_op = 'INSERT' then
    -- An omitted created_at arrives here already set to now() by the column
    -- default (now() is fixed for the transaction), so anything else was
    -- supplied by the client. A null (a bulk insert with a missing key) is
    -- stamped rather than rejected.
    if new.created_at is not null and new.created_at is distinct from now() then
      raise exception 'created_at is set by the server'
        using errcode = '42501';
    end if;
    new.created_at := now();
  else
    -- An existing lead message can't be edited, and no row can be moved in
    -- time.
    if old.role = 'user' or old.source = 'lead' then
      raise exception 'lead messages are written by the server only'
        using errcode = '42501';
    end if;
    if new.created_at is distinct from old.created_at then
      raise exception 'created_at is set by the server'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_lead_messages on public.messages;
create trigger protect_lead_messages
  before insert or update on public.messages
  for each row execute function public.protect_lead_messages();

create or replace function public.protect_dm_meter()
returns trigger
language plpgsql
as $$
declare
  jwt_role text := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    current_setting('request.jwt.claim.role', true)
  );
begin
  if jwt_role in ('authenticated', 'anon') then
    if (tg_op = 'INSERT' and new.dm_counted_at is not null)
      or (tg_op = 'UPDATE' and new.dm_counted_at is distinct from old.dm_counted_at)
    then
      raise exception 'dm_counted_at is written by the server only'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_dm_meter on public.conversations;
create trigger protect_dm_meter
  before insert or update on public.conversations
  for each row execute function public.protect_dm_meter();

-- Trigger functions are not browser-callable (and 20261007120000 removes
-- the default EXECUTE), but revoke explicitly so the grant check stays
-- clean if this file runs first.
revoke execute on function public.protect_lead_messages() from public, anon, authenticated;
revoke execute on function public.protect_dm_meter() from public, anon, authenticated;

-- Verify after running:
--   select tgname from pg_trigger
--    where tgrelid in ('public.messages'::regclass, 'public.conversations'::regclass)
--      and tgname in ('protect_lead_messages', 'protect_dm_meter');  -- 2 rows
