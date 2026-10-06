-- Card-required trial + single access check (run manually, BEFORE deploying
-- the code: the app selects current_period_end on every access check, and
-- selecting a missing column fails those reads).
--
-- 1. users.current_period_end: end of the current Stripe period (trial or
--    paid), written only by the Stripe webhook. src/lib/billing/access.js
--    uses it so a subscription whose period has ended stops having access
--    even if a webhook is missed. Not on the browser UPDATE allowlist
--    (20261005150000), and added to protect_billing_columns below.

alter table public.users
  add column if not exists current_period_end timestamptz;

comment on column public.users.current_period_end is
  'End of the current Stripe billing period (trial or paid). Written only by the Stripe webhook.';

-- protect_billing_columns: same body as live (20261001120000) plus
-- current_period_end. Defense in depth; the browser has no UPDATE on these
-- columns anyway.
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
      or new.current_period_end is distinct from old.current_period_end
    then
      raise exception 'billing columns are read-only'
        using errcode = '42501'; -- insufficient_privilege
    end if;
  end if;
  return new;
end;
$$;
