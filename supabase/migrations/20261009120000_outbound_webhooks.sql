-- Outbound lifecycle webhooks, managed accounts, per-account persona.
--
-- Run manually, BEFORE the deploy that ships the code (the code reads the
-- new columns; the triggers emit nothing until an account has an enabled
-- outbound_webhooks row, so running it early changes no behavior).
-- Re-runnable.
--
-- 1. users: server-only columns. None is in the browser UPDATE allowlist
--    (migration 20261005150000 grants named columns only), and
--    protect_server_user_columns rejects browser writes as defense in depth.
--      billing_managed      managed (invoiced outside Clinchd) account:
--                           accessDecision kind 'managed'
--      webhook_demo         demo account: may record demo bookings that emit
--                           consultation_booked with data.demo = true
--      assistant_name       persona name ("Katlynne"); always disclosed as AI
--      business_name        the business the inbox belongs to
--      holding_text         handoff holding text override
--      booking_url          booking link for booking_link_sent detection
--                           (falls back to calendly_url)
--      treatment_categories [{"key":"botox","match":["botox","tox"]}, ...]
--
-- 2. lead_profiles: validated lead facts per conversation (Instagram
--    username, email, E.164 phone, treatment category key). Server-only.
--
-- 3. outbound_webhooks: one destination per account; the signing secret is
--    AES-256-GCM encrypted with ENCRYPTION_KEY (src/lib/encryption.js).
--    No browser access at all.
--
-- 4. outbound_webhook_events: the outbox. AFTER triggers on conversations,
--    messages, bookings and lead_profiles insert the event row inside the
--    same transaction as the state change. A unique (user_id, dedupe_key)
--    makes every lifecycle step emit at most once. The cron
--    (/api/cron/outbound-webhooks) delivers; nothing on a DM path calls the
--    destination.
--
--    Triggers emit only for server writes (service role or direct SQL):
--    the browser can write its own conversations, messages and bookings
--    (RLS), and must not be able to forge lifecycle events. Same JWT role
--    detection as protect_billing_columns.
--
--    A trigger never fails the write it rides on: every body catches all
--    errors, records them in outbound_webhook_emit_failures and raises a
--    WARNING. The cron logs each recorded failure once.
--
-- 5. claim_outbound_webhook_events: FOR UPDATE SKIP LOCKED claim with stale
--    takeover. SECURITY INVOKER, service_role only.
--
-- No SECURITY DEFINER functions. Trigger functions run as the writer, which
-- is the service role (or postgres) whenever they do anything.

-- ── 1. users ─────────────────────────────────────────────────────────────

alter table public.users
  add column if not exists billing_managed boolean not null default false,
  add column if not exists webhook_demo boolean not null default false,
  add column if not exists assistant_name text,
  add column if not exists business_name text,
  add column if not exists holding_text text,
  add column if not exists booking_url text,
  add column if not exists treatment_categories jsonb;

do $$ begin
  alter table public.users add constraint users_assistant_name_check
    check (assistant_name is null or (char_length(assistant_name) between 1 and 40 and assistant_name !~ '[[:cntrl:]]'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.users add constraint users_business_name_check
    check (business_name is null or (char_length(business_name) between 1 and 80 and business_name !~ '[[:cntrl:]]'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.users add constraint users_holding_text_check
    check (holding_text is null or char_length(holding_text) between 1 and 300);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.users add constraint users_booking_url_check
    check (booking_url is null or (booking_url ~ '^https://' and char_length(booking_url) <= 500));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.users add constraint users_treatment_categories_check
    check (treatment_categories is null or (jsonb_typeof(treatment_categories) = 'array'
           and pg_column_size(treatment_categories) <= 20000));
exception when duplicate_object then null; end $$;

create or replace function public.protect_server_user_columns()
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
    if new.billing_managed is distinct from old.billing_managed
      or new.webhook_demo is distinct from old.webhook_demo
      or new.assistant_name is distinct from old.assistant_name
      or new.business_name is distinct from old.business_name
      or new.holding_text is distinct from old.holding_text
      or new.booking_url is distinct from old.booking_url
      or new.treatment_categories is distinct from old.treatment_categories
    then
      raise exception 'server-managed columns are read-only'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_server_user_columns on public.users;
create trigger protect_server_user_columns
  before update on public.users
  for each row execute function public.protect_server_user_columns();

-- ── 2. lead_profiles ─────────────────────────────────────────────────────

create table if not exists public.lead_profiles (
  conversation_id uuid primary key references public.conversations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  instagram_username text check (instagram_username is null or instagram_username ~ '^[A-Za-z0-9._]{1,30}$'),
  email text check (email is null or (char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  treatment_interest text check (treatment_interest is null or treatment_interest ~ '^[a-z0-9][a-z0-9_-]{0,39}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lead_profiles_user_email_idx on public.lead_profiles (user_id, email) where email is not null;

alter table public.lead_profiles enable row level security;
revoke all on public.lead_profiles from anon, authenticated;

-- ── 3. outbound_webhooks ─────────────────────────────────────────────────

create table if not exists public.outbound_webhooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  url text not null check (url ~ '^https://' and char_length(url) <= 2048),
  enabled boolean not null default false,
  event_types text[] not null default array[
    'new_inquiry','dm_started','contact_captured','booking_link_sent',
    'consultation_booked','follow_up_sent','handoff_requested'
  ]::text[] check (event_types <@ array[
    'new_inquiry','dm_started','contact_captured','booking_link_sent',
    'consultation_booked','follow_up_sent','handoff_requested','test'
  ]::text[]),
  secret_encrypted text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  rotated_at timestamptz
);

alter table public.outbound_webhooks enable row level security;
revoke all on public.outbound_webhooks from anon, authenticated;

-- ── 4. outbox ────────────────────────────────────────────────────────────

create table if not exists public.outbound_webhook_events (
  -- The public event id is 'evt_' || id: globally unique, reused on every
  -- retry and replay.
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  event_type text not null check (event_type in (
    'new_inquiry','dm_started','contact_captured','booking_link_sent',
    'consultation_booked','follow_up_sent','handoff_requested','test')),
  -- One lifecycle step = one key, e.g. 'dm_started:<conversation id>'.
  dedupe_key text not null,
  -- No foreign keys: the retention jobs delete conversations and bookings,
  -- and the delivery metadata must outlive them.
  conversation_id uuid,
  booking_id uuid,
  -- Contract-safe facts captured at emit time (e.g. {"reason": "other"}).
  data jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('pending','processing','delivered','failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  last_status integer,
  last_error text,
  destination_host text,
  -- The exact body bytes, frozen on the first attempt. Purged 30 days after
  -- delivered/failed (payload_purged_at); the metadata stays.
  payload text,
  payload_purged_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  constraint outbound_webhook_events_dedupe unique (user_id, dedupe_key)
);
create index if not exists outbound_webhook_events_due_idx
  on public.outbound_webhook_events (next_attempt_at)
  where status in ('pending','processing');
create index if not exists outbound_webhook_events_purge_idx
  on public.outbound_webhook_events (finished_at)
  where payload is not null;
create index if not exists outbound_webhook_events_conversation_idx
  on public.outbound_webhook_events (conversation_id, event_type);

alter table public.outbound_webhook_events enable row level security;
revoke all on public.outbound_webhook_events from anon, authenticated;

create table if not exists public.outbound_webhook_emit_failures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  event_type text,
  sqlstate text,
  message text,
  reported_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists outbound_webhook_emit_failures_unreported_idx
  on public.outbound_webhook_emit_failures (created_at) where reported_at is null;

alter table public.outbound_webhook_emit_failures enable row level security;
revoke all on public.outbound_webhook_emit_failures from anon, authenticated;

-- ── Emit helpers ─────────────────────────────────────────────────────────

-- Insert one outbox row if the account has an enabled webhook subscribed to
-- this type. Duplicate keys are ignored (the step already emitted).
create or replace function public.outbound_emit(
  p_user uuid, p_type text, p_key text, p_conversation uuid, p_booking uuid, p_data jsonb
)
returns void
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.outbound_webhooks w
     where w.user_id = p_user and w.enabled and p_type = any (w.event_types)
  ) then
    return;
  end if;
  insert into public.outbound_webhook_events
    (user_id, event_type, dedupe_key, conversation_id, booking_id, data)
  values
    (p_user, p_type, p_key, p_conversation, p_booking, coalesce(p_data, '{}'::jsonb))
  on conflict (user_id, dedupe_key) do nothing;
end;
$$;

-- Called from a trigger's exception handler. Never raises an error itself.
create or replace function public.outbound_note_emit_failure(
  p_user uuid, p_type text, p_sqlstate text, p_message text
)
returns void
language plpgsql
set search_path = public
as $$
begin
  begin
    insert into public.outbound_webhook_emit_failures (user_id, event_type, sqlstate, message)
    values (p_user, p_type, p_sqlstate, left(p_message, 300));
  exception when others then
    null;
  end;
  raise warning 'outbound webhook emit failed (type %, sqlstate %): %', p_type, p_sqlstate, left(p_message, 300);
end;
$$;

-- 'https://www.Cal.com/x/' -> 'cal.com/x': what a reply must contain for the
-- booking link to count as sent. Null for anything too short to be a link.
create or replace function public.outbound_link_core(p_url text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when char_length(c) >= 8 then c
  end
  from (select lower(regexp_replace(regexp_replace(coalesce(p_url, ''), '^\s*https?://(www\.)?', '', 'i'), '[/\s]+$', '')) as c) s;
$$;

-- ── Triggers ─────────────────────────────────────────────────────────────

-- new_inquiry: a lead's conversation is created by the server. 'inbound' is
-- an inbound-first DM; 'clinchd_sent' is the comment-to-DM path (the only
-- server path that inserts that origin). 'native_send' (the clinic's own
-- typed cold DM) is not an inquiry.
create or replace function public.outbound_on_conversation_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  begin
    if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
                current_setting('request.jwt.claim.role', true), '') in ('authenticated', 'anon') then
      return null;
    end if;
    if new.origin in ('inbound', 'clinchd_sent') then
      perform public.outbound_emit(new.user_id, 'new_inquiry', 'new_inquiry:' || new.id, new.id, null, '{}'::jsonb);
    end if;
  exception when others then
    begin
      perform public.outbound_note_emit_failure(new.user_id, 'new_inquiry', sqlstate, sqlerrm);
    exception when others then
      raise warning 'outbound webhook emit failed: %', sqlerrm;
    end;
  end;
  return null;
end;
$$;

drop trigger if exists outbound_on_conversation_insert on public.conversations;
create trigger outbound_on_conversation_insert
  after insert on public.conversations
  for each row execute function public.outbound_on_conversation_insert();

-- handoff_requested: ai_paused goes false -> true. Only the pauses that
-- hand the lead to a person; human_took_over (staff already replied) and
-- the silent do-not-send pauses emit nothing.
create or replace function public.outbound_on_conversation_pause()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_reason text;
begin
  begin
    if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
                current_setting('request.jwt.claim.role', true), '') in ('authenticated', 'anon') then
      return null;
    end if;
    if new.ai_paused is true and old.ai_paused is not true then
      v_reason := case new.ai_pause_reason
        when 'medical_question' then 'medical_question'
        when 'missing_knowledge' then 'missing_knowledge'
        when 'complex_objection' then 'other'
        when 'qualifying_loop_detected' then 'other'
        when 'hostile_or_refund' then 'other'
        when 'crisis_signal' then 'other'
      end;
      if v_reason is not null then
        perform public.outbound_emit(
          new.user_id, 'handoff_requested',
          'handoff_requested:' || new.id || ':' || extract(epoch from now())::text,
          new.id, null, jsonb_build_object('reason', v_reason));
      end if;
    end if;
  exception when others then
    begin
      perform public.outbound_note_emit_failure(new.user_id, 'handoff_requested', sqlstate, sqlerrm);
    exception when others then
      raise warning 'outbound webhook emit failed: %', sqlerrm;
    end;
  end;
  return null;
end;
$$;

drop trigger if exists outbound_on_conversation_pause on public.conversations;
create trigger outbound_on_conversation_pause
  after update of ai_paused on public.conversations
  for each row execute function public.outbound_on_conversation_pause();

-- dm_started / booking_link_sent / follow_up_sent: an assistant message the
-- app wrote (source agent or drip) was actually delivered, i.e. its Meta
-- message id is set. Reply rows are saved before the send and keep no id
-- when the send fails or is rate-limited, so the id is the proof of send.
create or replace function public.outbound_on_message_sent()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_user uuid;
  v_booking text;
  v_calendly text;
  v_body text;
begin
  begin
    if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
                current_setting('request.jwt.claim.role', true), '') in ('authenticated', 'anon')
       or new.role <> 'assistant'
       or new.source not in ('agent', 'drip')
       or new.provider_message_id is null
       or (tg_op = 'UPDATE' and old.provider_message_id is not null) then
      return null;
    end if;

    select c.user_id into v_user from public.conversations c where c.id = new.conversation_id;
    if v_user is null
       or not exists (select 1 from public.outbound_webhooks w where w.user_id = v_user and w.enabled) then
      return null;
    end if;

    perform public.outbound_emit(v_user, 'dm_started', 'dm_started:' || new.conversation_id,
                                 new.conversation_id, null, '{}'::jsonb);

    select public.outbound_link_core(u.booking_url), public.outbound_link_core(u.calendly_url)
      into v_booking, v_calendly
      from public.users u where u.id = v_user;
    v_body := lower(coalesce(new.content, ''));
    if (v_booking is not null and strpos(v_body, v_booking) > 0)
       or (v_calendly is not null and strpos(v_body, v_calendly) > 0) then
      perform public.outbound_emit(v_user, 'booking_link_sent', 'booking_link_sent:' || new.conversation_id,
                                   new.conversation_id, null, '{}'::jsonb);
    end if;

    if new.source = 'drip' then
      perform public.outbound_emit(v_user, 'follow_up_sent', 'follow_up_sent:' || new.id,
                                   new.conversation_id, null, '{}'::jsonb);
    end if;
  exception when others then
    begin
      perform public.outbound_note_emit_failure(v_user, 'message_sent', sqlstate, sqlerrm);
    exception when others then
      raise warning 'outbound webhook emit failed: %', sqlerrm;
    end;
  end;
  return null;
end;
$$;

drop trigger if exists outbound_on_message_sent on public.messages;
create trigger outbound_on_message_sent
  after insert or update of provider_message_id on public.messages
  for each row execute function public.outbound_on_message_sent();

-- consultation_booked: a real Calendly booking (source 'calendly' with an
-- invitee URI, confirmed), or a demo booking on a webhook_demo account.
-- Manual bookings from the dashboard never emit.
create or replace function public.outbound_on_booking()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_demo boolean;
begin
  begin
    if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
                current_setting('request.jwt.claim.role', true), '') in ('authenticated', 'anon') or new.status is distinct from 'confirmed' then
      return null;
    end if;
    if new.source = 'calendly' and new.calendly_invitee_uri is not null then
      perform public.outbound_emit(new.user_id, 'consultation_booked', 'consultation_booked:' || new.id,
                                   new.conversation_id, new.id, '{}'::jsonb);
    elsif new.source = 'demo' then
      select u.webhook_demo into v_demo from public.users u where u.id = new.user_id;
      if v_demo is true then
        perform public.outbound_emit(new.user_id, 'consultation_booked', 'consultation_booked:' || new.id,
                                     new.conversation_id, new.id, jsonb_build_object('demo', true));
      end if;
    end if;
  exception when others then
    begin
      perform public.outbound_note_emit_failure(new.user_id, 'consultation_booked', sqlstate, sqlerrm);
    exception when others then
      raise warning 'outbound webhook emit failed: %', sqlerrm;
    end;
  end;
  return null;
end;
$$;

drop trigger if exists outbound_on_booking on public.bookings;
create trigger outbound_on_booking
  after insert or update on public.bookings
  for each row execute function public.outbound_on_booking();

-- contact_captured: a new validated email or phone on a lead profile. Keyed
-- on the value's hash, so a changed value emits again and a repeated one
-- never does; capped at 6 per conversation.
create or replace function public.outbound_on_lead_profile()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_count integer;
begin
  begin
    if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
                current_setting('request.jwt.claim.role', true), '') in ('authenticated', 'anon') then
      return null;
    end if;
    select count(*) into v_count from public.outbound_webhook_events e
     where e.conversation_id = new.conversation_id and e.event_type = 'contact_captured';
    if v_count >= 6 then
      return null;
    end if;
    if new.email is not null and (tg_op = 'INSERT' or new.email is distinct from old.email) then
      perform public.outbound_emit(new.user_id, 'contact_captured',
        'contact_captured:' || new.conversation_id || ':email:' || left(encode(sha256(convert_to(new.email, 'UTF8')), 'hex'), 16),
        new.conversation_id, null, '{}'::jsonb);
    end if;
    if new.phone is not null and (tg_op = 'INSERT' or new.phone is distinct from old.phone) then
      perform public.outbound_emit(new.user_id, 'contact_captured',
        'contact_captured:' || new.conversation_id || ':phone:' || left(encode(sha256(convert_to(new.phone, 'UTF8')), 'hex'), 16),
        new.conversation_id, null, '{}'::jsonb);
    end if;
  exception when others then
    begin
      perform public.outbound_note_emit_failure(new.user_id, 'contact_captured', sqlstate, sqlerrm);
    exception when others then
      raise warning 'outbound webhook emit failed: %', sqlerrm;
    end;
  end;
  return null;
end;
$$;

drop trigger if exists outbound_on_lead_profile on public.lead_profiles;
create trigger outbound_on_lead_profile
  after insert or update of email, phone on public.lead_profiles
  for each row execute function public.outbound_on_lead_profile();

-- ── 5. Claim ─────────────────────────────────────────────────────────────

-- Claims due events (pending and due, or processing and stale: a run that
-- died mid-delivery) and counts the attempt. Overlapping cron runs skip
-- each other's rows.
create or replace function public.claim_outbound_webhook_events(
  p_batch integer default 25, p_stale_seconds integer default 120
)
returns setof public.outbound_webhook_events
language sql
security invoker
set search_path = public
as $$
  update public.outbound_webhook_events e
     set status = 'processing', claimed_at = now(), attempts = e.attempts + 1
   where e.id in (
     select x.id from public.outbound_webhook_events x
      where (x.status = 'pending' and x.next_attempt_at <= now())
         or (x.status = 'processing' and x.claimed_at < now() - make_interval(secs => p_stale_seconds))
      order by x.next_attempt_at
      limit p_batch
      for update skip locked
   )
  returning e.*;
$$;

-- Server-only: every function above. Trigger functions can't be called
-- directly, but revoke them too so the browser sees nothing new.
revoke execute on function public.outbound_emit(uuid, text, text, uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.outbound_note_emit_failure(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.outbound_link_core(text) from public, anon, authenticated;
revoke execute on function public.outbound_on_conversation_insert() from public, anon, authenticated;
revoke execute on function public.outbound_on_conversation_pause() from public, anon, authenticated;
revoke execute on function public.outbound_on_message_sent() from public, anon, authenticated;
revoke execute on function public.outbound_on_booking() from public, anon, authenticated;
revoke execute on function public.outbound_on_lead_profile() from public, anon, authenticated;
revoke execute on function public.protect_server_user_columns() from public, anon, authenticated;
revoke execute on function public.claim_outbound_webhook_events(integer, integer) from public, anon, authenticated;
grant execute on function public.claim_outbound_webhook_events(integer, integer) to service_role;
-- The triggers call these as the writer, which is the service role.
grant execute on function public.outbound_emit(uuid, text, text, uuid, uuid, jsonb) to service_role;
grant execute on function public.outbound_note_emit_failure(uuid, text, text, text) to service_role;
grant execute on function public.outbound_link_core(text) to service_role;
grant select, insert, update, delete on public.lead_profiles, public.outbound_webhooks,
  public.outbound_webhook_events, public.outbound_webhook_emit_failures to service_role;
