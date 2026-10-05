-- ROLLBACK ONLY. Run if the card-required billing deploy is reverted.
--
-- Migration 20261006130000 changed handle_new_user so new signups start as
-- 'inactive' with no trial; the OLD code has no Checkout-first flow, so
-- under it those users would never get access. This restores the exact
-- live definition from before (read from production 2026-10-06): a 7-day
-- no-card trial at signup.
--
-- Safe to leave in place on rollback: users.current_period_end,
-- protect_billing_columns (with current_period_end), billing_trial_ledger,
-- stripe_webhook_events. The old code doesn't read them.
--
-- After running, list users who signed up while the new code was live and
-- are still 'inactive' with no Stripe subscription (they got no trial):
--   select id, email, created_at from public.users
--   where subscription_status = 'inactive' and stripe_subscription_id is null
--     and created_at > '<deploy time>';
-- Granting them a trial is a separate, approved, row-by-row update.

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    full_name,
    plan,
    subscription_status,
    trial_ends_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'base',
    'trialing',
    NOW() + INTERVAL '7 days'
  );
  RETURN NEW;
END;
$function$;
