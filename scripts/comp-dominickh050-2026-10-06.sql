-- ONE-ROW update, run manually ONLY after Dom approves.
-- Extends a comped account to match the other comped accounts (2099).
--
-- Affects exactly 1 row:
--   dominickh050@gmail.com  a38be3ba-052a-43f6-aadc-c97c2edf1cfb
--   status active, no stripe_subscription_id (comped)  -- unchanged
--   trial_ends_at  2027-04-15 05:03:53.663674+00  ->  2099-12-31 23:59:59+00

begin;

update public.users
set trial_ends_at = '2099-12-31 23:59:59+00'
where id = 'a38be3ba-052a-43f6-aadc-c97c2edf1cfb'
  and email = 'dominickh050@gmail.com'
  and subscription_status = 'active'
  and stripe_subscription_id is null
  and trial_ends_at = '2027-04-15 05:03:53.663674+00';
-- expect: UPDATE 1

commit;
