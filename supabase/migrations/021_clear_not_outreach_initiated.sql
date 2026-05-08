-- 021_clear_not_outreach_initiated.sql
--
-- Drops the now-removed 'not_outreach_initiated' skip reason from any
-- conversation that was marked while the outreach-only gate was active.
-- The gate has been removed in favor of the existing human_in_loop
-- classifier, so this value should never be set going forward and the
-- UI no longer renders a badge for it.

UPDATE public.conversations
SET last_skip_reason = NULL
WHERE last_skip_reason = 'not_outreach_initiated';
