-- Card-required trial, signup side (run manually, BEFORE deploying the code).
--
-- 1. handle_new_user: new rows start as subscription_status 'inactive' (the
--    column default) with NO trial_ends_at. The 7-day trial now comes from
--    Stripe Checkout (card required). Existing rows are unchanged.
-- 2. billing_trial_ledger: one row per person (normalized email) who has
--    trialed or subscribed. Server-only. No foreign key to users, so a row
--    survives account deletion: deleting an account and signing up again
--    must not earn a second trial (it did for one customer).
-- 3. normalize_email_for_trial(text): the SQL twin of
--    normalizeEmailForTrial in src/lib/billing/trial-policy.js (lowercase,
--    trim, drop +suffix, Gmail dots dropped, googlemail.com -> gmail.com).
--    Used for the backfill below; the app normalizes in JS.
-- 4. Backfill: every existing user had a no-card trial under the old
--    signup, so all current emails go into the ledger ('legacy_backfill').
--    That changes no users row; it only means none of these emails gets a
--    second trial. ON CONFLICT DO NOTHING, so re-running is safe.

-- 1 ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  -- subscription_status and ai_mode take their column defaults
  -- ('inactive', 'handoff'). No trial_ends_at: access starts when Stripe
  -- Checkout completes and the webhook records the subscription.
  insert into public.users (id, email, full_name, plan)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'base'
  );
  return new;
end;
$$;

-- 2 ---------------------------------------------------------------------------

create table if not exists public.billing_trial_ledger (
  normalized_email text primary key,
  stripe_customer_id text,
  source text not null,
  first_seen_at timestamptz not null default now()
);

comment on table public.billing_trial_ledger is
  'One row per person (normalized email) who has trialed or subscribed. Server-only; no FK to users so it survives account deletion. Blocks a second trial.';

-- RLS on, no policies, no grants: only the service role (webhooks, the
-- checkout route) reads or writes it.
alter table public.billing_trial_ledger enable row level security;
revoke all on public.billing_trial_ledger from anon, authenticated;

-- 3 ---------------------------------------------------------------------------

create or replace function public.normalize_email_for_trial(email text)
returns text
language sql
immutable
as $$
  with parts as (
    select
      split_part(lower(btrim(email)), '@', 1) as local_raw,
      case split_part(lower(btrim(email)), '@', 2)
        when 'googlemail.com' then 'gmail.com'
        else split_part(lower(btrim(email)), '@', 2)
      end as domain
  ),
  cleaned as (
    select
      domain,
      case when domain = 'gmail.com'
        then replace(split_part(local_raw, '+', 1), '.', '')
        else split_part(local_raw, '+', 1)
      end as local
    from parts
  )
  select case
    when email is null or position('@' in email) = 0 or local = '' or domain = '' then null
    else local || '@' || domain
  end
  from cleaned;
$$;

-- 4 ---------------------------------------------------------------------------

insert into public.billing_trial_ledger (normalized_email, stripe_customer_id, source)
select distinct on (public.normalize_email_for_trial(email))
  public.normalize_email_for_trial(email),
  stripe_customer_id,
  'legacy_backfill'
from public.users
where public.normalize_email_for_trial(email) is not null
order by public.normalize_email_for_trial(email), created_at
on conflict (normalized_email) do nothing;

-- Verify after running:
--   select count(*) from public.billing_trial_ledger;  -- expect the number of distinct normalized user emails
--   select pg_get_functiondef('public.handle_new_user'::regproc);  -- no 'trialing', no trial_ends_at
