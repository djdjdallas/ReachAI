-- ONE-TIME backfill, run manually ONLY after Dom approves the rows below.
-- Values read from Stripe live on 2026-10-05 (GET /v1/subscriptions).
-- Requires migration 20261006120000 (current_period_end) first.
--
-- Affects exactly 1 row:
--   greenevans97@gmail.com  cf50e022-5e56-48cf-9eb5-fbffaff4b8ac
--   sub_1UJmunGplBlBR1AHNa5X84zi  status active (unchanged)
--     cancel_at          null -> 2026-10-26 04:08:43+00  (Stripe cancel_at 1792987723)
--     canceled_at        null -> 2026-09-26 15:47:37+00  (Stripe canceled_at 1790437657)
--     current_period_end null -> 2026-10-26 04:08:43+00  (item current_period_end 1792987723)
--
-- Not touched: jaguilar79 (sub_1TnERN..., canceled in July; no access either way).

begin;

update public.users
set cancel_at = '2026-10-26 04:08:43+00',
    canceled_at = '2026-09-26 15:47:37+00',
    current_period_end = '2026-10-26 04:08:43+00'
where id = 'cf50e022-5e56-48cf-9eb5-fbffaff4b8ac'
  and stripe_subscription_id = 'sub_1UJmunGplBlBR1AHNa5X84zi'
  and cancel_at is null
  and current_period_end is null;
-- expect: UPDATE 1

commit;
