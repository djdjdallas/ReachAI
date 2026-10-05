-- When the post-connect Instagram auto-import FINISHED (success or skip).
--
-- instagram_auto_import_attempted_at is stamped BEFORE the work starts (it is
-- the single-attempt lock), so the onboarding page, which stopped polling as
-- soon as it saw that stamp, gave up ~6.5s before the imported voice profile,
-- offer, target customer, objections and greeting were written. The page now
-- waits for this column instead.
--
-- Written by src/app/api/instagram/auto-profile/route.js. Nullable, no
-- default, no backfill: existing users already finished onboarding or never
-- connected, and the page treats a missing value as "wait up to the cap".
--
-- Safe to deploy the code before running this: the route's write is
-- best-effort and the page falls back to its time cap.
--
-- Run manually.

alter table public.users
  add column if not exists instagram_auto_import_finished_at timestamptz;

comment on column public.users.instagram_auto_import_finished_at is
  'When the post-connect Instagram auto-import finished (success or skip). Null while running or never run.';

-- Verify after running:
--   select column_name, data_type from information_schema.columns
--   where table_schema = 'public' and table_name = 'users'
--     and column_name = 'instagram_auto_import_finished_at';
