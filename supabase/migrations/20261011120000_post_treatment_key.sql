-- Comment-to-DM: an optional treatment tag per watched post (persona
-- accounts). The key is one of the account's users.treatment_categories
-- keys; {{TREATMENT}} in comment DMs renders its label, and a comment-to-DM
-- thread started on the post seeds lead_profiles.treatment_interest with it
-- (which emits lead_updated).
--
-- Only the format is checked here. Whether the key is in the account's
-- list is checked by the settings route on save and again by the comment
-- pipeline on use (src/lib/webhooks/comment-event.js), so a key the account
-- later removes is ignored, never sent.
--
-- Run manually, BEFORE the deploy that ships the code: the new code selects
-- this column, and the comment pipeline's monitoring read fails without it
-- (every comment would skip as "no monitoring row").
--
-- Re-runnable. Adding a nullable column with no default is a metadata-only
-- change; gives up after 3 seconds instead of queueing traffic.

set lock_timeout = '3s';

alter table public.post_monitoring_settings
  add column if not exists treatment_key text;

alter table public.post_monitoring_settings
  drop constraint if exists post_monitoring_settings_treatment_key_check;
alter table public.post_monitoring_settings
  add constraint post_monitoring_settings_treatment_key_check
    check (treatment_key is null or treatment_key ~ '^[a-z0-9][a-z0-9_-]{0,39}$');
