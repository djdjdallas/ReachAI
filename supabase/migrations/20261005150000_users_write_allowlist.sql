-- Browser writes to public.users: allowlist, activation guard, CHECKs.
--
-- Before this, the authenticated and anon roles held INSERT, UPDATE,
-- DELETE and TRUNCATE on the whole table. RLS limited them to the user's
-- own row and protect_billing_columns (20260824120100) denied a handful of
-- billing columns, but any other column (tokens, ai_mode, connection
-- state) was writable from the browser console. TRUNCATE bypasses RLS.
--
-- What this migration does (run manually):
--   1. ai_mode defaults to 'handoff' (was 'active'). Existing rows are not
--      changed. Onboarding writes 'active' explicitly when it finishes with
--      an opening line, so new accounts no longer start "on" with nothing
--      to say (all 6 accounts with AI on and no greeting never finished
--      onboarding; Christian held 154 conversations this way).
--   2. Column-level privileges: revoke INSERT, UPDATE, DELETE, TRUNCATE
--      from authenticated and anon, then grant UPDATE on only the 14
--      columns the browser legitimately writes. Approved 2026-10-05.
--      No browser path inserts or deletes users rows (signup rows come from
--      the handle_new_user trigger; deletion runs server-side as admin).
--      Server code uses the service role and is unaffected.
--      A column added to users later is NOT browser-writable unless a
--      migration grants it.
--   3. protect_ai_activation trigger (browser roles only): the AI can't be
--      switched on, and the opening line can't be cleared while it's on,
--      without a non-empty script_config.greeting; greeting max 1000 chars;
--      voice_profile may only be cleared (null) or reverted to its
--      previous_profile, the only two shapes the browser writes.
--   4. CHECK constraints on browser-written fields: calendly_url,
--      script_config size, phone_number (E.164). Every existing row passes
--      (checked 2026-10-05).
--
-- protect_billing_columns stays as defense in depth.

-- 1. Default ----------------------------------------------------------------

alter table public.users alter column ai_mode set default 'handoff';

-- 2. Privileges -------------------------------------------------------------

-- Revoking at table level also revokes the per-column privileges it implied.
revoke insert, update, delete, truncate on public.users from authenticated, anon;

grant update (
  full_name,
  response_delay,
  avg_deal_value,
  phone_number,
  notify_hot_leads_email,
  notify_bookings_email,
  notify_hot_leads_sms,
  notify_bookings_sms,
  script_config,
  calendly_url,
  voice_profile,
  has_seen_onboarding_modal,
  onboarding_completed,
  ai_mode
) on public.users to authenticated;

-- 3. Activation guard trigger ----------------------------------------------

create or replace function public.protect_ai_activation()
returns trigger
language plpgsql
as $$
declare
  -- Same role detection as protect_billing_columns: only requests carrying
  -- a client JWT are checked. Service role (webhooks, API routes) and
  -- direct SQL are not, e.g. Stripe reactivation restoring ai_mode.
  jwt_role text := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    current_setting('request.jwt.claim.role', true)
  );
  new_greeting text := btrim(coalesce(new.script_config ->> 'greeting', ''));
  old_greeting text := btrim(coalesce(old.script_config ->> 'greeting', ''));
begin
  if jwt_role in ('authenticated', 'anon') then
    -- Opening line length (Instagram's text DM limit). Only checked when the
    -- greeting changes, so an unrelated save never trips on old data.
    if new_greeting is distinct from old_greeting and char_length(new_greeting) > 1000 then
      raise exception 'opening_line_required: too_long'
        using errcode = '23514';
    end if;

    -- The AI can't be on without an opening line: the webhook holds every
    -- inbound lead until one exists. Rejects (a) switching to 'active'
    -- with no greeting and (b) clearing the greeting while 'active'.
    -- Accounts ALREADY in that state (from the old 'active' default) can
    -- still save other fields; they see a dashboard banner instead.
    if new.ai_mode = 'active'
       and new_greeting = ''
       and (old.ai_mode is distinct from 'active' or old_greeting <> '') then
      raise exception 'opening_line_required: the AI cannot be on without an opening line'
        using errcode = '23514';
    end if;

    -- voice_profile: the browser only clears it (Settings, Script Builder)
    -- or reverts to the stored previous_profile (onboarding). Anything else
    -- must go through the analyze-voice / voice-chat routes.
    if new.voice_profile is distinct from old.voice_profile
       and new.voice_profile is not null
       and new.voice_profile is distinct from
           ((old.voice_profile -> 'previous_profile') || '{"previous_profile": null}'::jsonb)
    then
      raise exception 'voice_profile can only be cleared or reverted from the browser'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_ai_activation on public.users;
create trigger protect_ai_activation
  before update on public.users
  for each row
  execute function public.protect_ai_activation();

-- 4. CHECK constraints ------------------------------------------------------

-- Booking link: null, or https:// with no whitespace, max 500 chars. ''
-- is also allowed: one existing row holds it, and this migration changes
-- no data. The app now normalizes blank to null on save.
alter table public.users
  add constraint users_calendly_url_check
  check (
    calendly_url is null
    or calendly_url = ''
    or (calendly_url like 'https://%' and char_length(calendly_url) <= 500 and calendly_url !~ '\s')
  );

-- script_config: a JSON object, at most 100,000 bytes as text. Largest row
-- today is 25,815 characters; ~4x headroom. Business knowledge will live
-- in its own table, not here.
alter table public.users
  add constraint users_script_config_size_check
  check (
    script_config is null
    or (jsonb_typeof(script_config) = 'object' and octet_length(script_config::text) <= 100000)
  );

-- Phone: null or E.164, the same rule Settings validates before saving.
alter table public.users
  add constraint users_phone_number_check
  check (phone_number is null or phone_number ~ '^\+[1-9][0-9]{6,14}$');

-- Verify after running:
--
--   -- browser UPDATE columns (expect exactly the 14 above)
--   select column_name from information_schema.column_privileges
--   where table_schema = 'public' and table_name = 'users'
--     and grantee = 'authenticated' and privilege_type = 'UPDATE'
--   order by 1;
--
--   -- no table-level INSERT/UPDATE/DELETE/TRUNCATE left for browser roles
--   select grantee, privilege_type from information_schema.table_privileges
--   where table_schema = 'public' and table_name = 'users'
--     and grantee in ('authenticated', 'anon')
--   order by 1, 2;   -- expect only SELECT (and REFERENCES/TRIGGER if granted)
--
--   select column_default from information_schema.columns
--   where table_schema = 'public' and table_name = 'users' and column_name = 'ai_mode';
--   -- expect 'handoff'::text
