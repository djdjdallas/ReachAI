-- Card-required trial, signup side.
--
-- RUN IMMEDIATELY BEFORE DEPLOY, not earlier (see the deploy checklist in
-- the PR). After it, new signups start with no trial and need the new
-- card-required Checkout to get one; the code that provides it must ship
-- right after.
--
-- 1. handle_new_user: new rows start as subscription_status 'inactive' (the
--    column default) with NO trial_ends_at. The 7-day trial now comes from
--    Stripe Checkout (card required). Existing rows are unchanged.
-- 2. billing_trial_ledger: one row per person who has trialed or
--    subscribed, keyed by email_hash = HMAC-SHA256(normalized email,
--    TRIAL_LEDGER_SECRET), computed in the app (src/lib/billing/
--    trial-policy.js trialLedgerKey). No email addresses are stored. No
--    foreign key to users, so a row survives account deletion: deleting an
--    account and signing up again must not earn a second trial.
--    Server-only: RLS on, no policies, no grants to browser roles.
--
-- Seeding (every existing user had a no-card trial) is done by
-- scripts/seed-trial-ledger.mjs, not here: the hash needs the server
-- secret, which must not live in SQL.

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
  email_hash text primary key check (email_hash ~ '^[0-9a-f]{64}$'),
  stripe_customer_id text,
  source text not null,
  first_seen_at timestamptz not null default now()
);

comment on table public.billing_trial_ledger is
  'One row per person who has trialed or subscribed, keyed by HMAC-SHA256 of the normalized email (no emails stored). Server-only; no FK to users so it survives account deletion. Blocks a second trial.';

alter table public.billing_trial_ledger enable row level security;
revoke all on public.billing_trial_ledger from anon, authenticated;

-- Verify after running:
--   select pg_get_functiondef('public.handle_new_user'::regproc);  -- no 'trialing', no trial_ends_at
--   select count(*) from public.billing_trial_ledger;               -- 0 until the seed script runs
