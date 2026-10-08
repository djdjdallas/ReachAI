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
-- Run manually, BEFORE the deploy that ships the code. The code tolerates
-- the column being missing (on 42703 it reads without it, so no post has a
-- treatment tag), but tagging posts needs it.
--
-- Re-runnable; gives up after 3 seconds instead of queueing traffic (on
-- "canceling statement due to lock timeout", run it again). Locks:
--   - add column (nullable, no default): metadata only, no table scan.
--   - add constraint ... not valid: brief ACCESS EXCLUSIVE lock, no scan;
--     new and updated rows are checked from then on.
--   - validate constraint: scans the existing rows under SHARE UPDATE
--     EXCLUSIVE, which does not block reads or writes. It passes: on the
--     first run every treatment_key is null, and on a re-run every value
--     was written under this same check.

set lock_timeout = '3s';

alter table public.post_monitoring_settings
  add column if not exists treatment_key text;

alter table public.post_monitoring_settings
  drop constraint if exists post_monitoring_settings_treatment_key_check;
alter table public.post_monitoring_settings
  add constraint post_monitoring_settings_treatment_key_check
    check (treatment_key is null or treatment_key ~ '^[a-z0-9][a-z0-9_-]{0,39}$') not valid;
alter table public.post_monitoring_settings
  validate constraint post_monitoring_settings_treatment_key_check;
