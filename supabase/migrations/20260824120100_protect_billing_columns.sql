-- Billing columns on public.users are writable by their owner: the
-- "Users can update own profile" policy (001) has no column restrictions, so
-- any user can run e.g.
--   supabase.from('users').update({ trial_ends_at: '2030-01-01',
--                                   subscription_status: 'active' })
-- from the browser console and self-extend their trial.
--
-- RLS can't restrict columns, so this uses a BEFORE UPDATE trigger: requests
-- carrying a client JWT role (authenticated/anon) may not change billing
-- fields; service-role requests (webhooks, API routes via getSupabaseAdmin)
-- and direct SQL are unaffected.
--
-- Run manually.

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
    then
      raise exception 'billing columns are read-only'
        using errcode = '42501'; -- insufficient_privilege
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_billing_columns on public.users;
create trigger protect_billing_columns
  before update on public.users
  for each row
  execute function public.protect_billing_columns();

-- Verify after running (should error with 'billing columns are read-only'):
--   from the app's browser console:
--   await supabase.from('users').update({ trial_ends_at: '2030-01-01' }).eq('id', (await supabase.auth.getUser()).data.user.id)
