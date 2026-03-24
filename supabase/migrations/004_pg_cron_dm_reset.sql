-- Enable pg_cron extension for scheduled database jobs
create extension if not exists pg_cron;

-- Schedule DM count reset on 1st of every month at midnight UTC
-- This runs directly in the database with zero network overhead
select cron.schedule(
  'reset-monthly-dm-counts',
  '0 0 1 * *',
  $$
    update public.users
    set
      dm_count_this_month = 0,
      dm_count_reset_at = now(),
      updated_at = now();
  $$
);
