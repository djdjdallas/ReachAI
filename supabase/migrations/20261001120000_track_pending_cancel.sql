-- Track pending cancellations on public.users.
--
-- A customer who cancels in the Stripe portal keeps access until the period
-- ends: Stripe sets cancel_at (and canceled_at), but status stays 'active'.
-- users had no column for either, so the app showed a plain 'active' plan,
-- kept sending onboarding drip emails, and the founder only heard about it
-- at customer.subscription.deleted, weeks later.
--
-- Written by the customer.subscription.updated webhook
-- (src/app/api/webhooks/stripe/route.js); both columns are cleared when the
-- customer reactivates.
--
-- Verified 2026-10-01 against information_schema.columns: public.users has no
-- column containing "cancel".
--
-- Run manually, BEFORE deploying the code that writes these columns.

alter table public.users
  add column if not exists cancel_at timestamptz default null,
  add column if not exists canceled_at timestamptz default null;

comment on column public.users.cancel_at is
  'When the Stripe subscription will end (subscription.cancel_at). Set while a cancellation is pending; null otherwise.';
comment on column public.users.canceled_at is
  'When the customer requested the cancellation (subscription.canceled_at). Null when no cancellation is pending.';

-- Billing columns are read-only for client JWTs (20260824120100). The new
-- columns are billing state too: without this, a signed-in user could clear
-- their own pending cancellation from the browser console. Same function as
-- the live definition (checked 2026-10-01), plus cancel_at / canceled_at.
create or replace function public.protect_billing_columns()
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
    if new.plan is distinct from old.plan
      or new.subscription_status is distinct from old.subscription_status
      or new.trial_ends_at is distinct from old.trial_ends_at
      or new.stripe_customer_id is distinct from old.stripe_customer_id
      or new.stripe_subscription_id is distinct from old.stripe_subscription_id
      or new.dm_count_this_month is distinct from old.dm_count_this_month
      or new.dm_count_reset_at is distinct from old.dm_count_reset_at
      or new.voice_replies_enabled is distinct from old.voice_replies_enabled
      or new.drip_enabled is distinct from old.drip_enabled
      or new.cancel_at is distinct from old.cancel_at
      or new.canceled_at is distinct from old.canceled_at
    then
      raise exception 'billing columns are read-only'
        using errcode = '42501'; -- insufficient_privilege
    end if;
  end if;
  return new;
end;
$$;

-- The trigger itself (protect_billing_columns on public.users) already exists
-- and picks up the new function body automatically.

-- Verify after running:
--   select column_name, data_type from information_schema.columns
--   where table_schema = 'public' and table_name = 'users'
--     and column_name in ('cancel_at', 'canceled_at');
--
-- OPTIONAL one-time backfill, NOT run by default. The webhook only fills
-- these columns on the NEXT customer.subscription.updated event, so the one
-- pending cancellation that predates this migration stays empty until then.
-- Values read from Stripe on 2026-09-28 (sub_1UJmunGplBlBR1AHNa5X84zi).
-- Skip it if the refund also ends that subscription.
--
-- update public.users
-- set cancel_at = '2026-10-26 04:08:43+00',
--     canceled_at = '2026-09-26 15:47:37+00'
-- where id = 'cf50e022-5e56-48cf-9eb5-fbffaff4b8ac'
--   and stripe_subscription_id = 'sub_1UJmunGplBlBR1AHNa5X84zi';
