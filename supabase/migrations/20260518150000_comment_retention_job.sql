-- Migration: 90-day retention for comment-to-DM tables.
-- Run this manually in the Supabase SQL editor. Requires pg_cron
-- (already enabled in migration 004 for the DM counter reset).
--
-- Privacy policy commits to a 90-day window for comment data. After that
-- the classifier output, dispatch log, and processing queue rows are
-- deleted. comment_processing_queue rows in transient states ('pending',
-- 'rate_limited') are left alone — the worker (Phase 3+) owns that state
-- and the cron should not race it.
--
-- comment_classifications.classified_at and comment_to_dm_log.simulated_at
-- already exist; comment_processing_queue uses created_at. Each delete
-- targets the column that exists on its own table.

CREATE OR REPLACE FUNCTION public.purge_old_comment_data()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.comment_classifications
  WHERE classified_at < NOW() - INTERVAL '90 days';

  DELETE FROM public.comment_to_dm_log
  WHERE simulated_at < NOW() - INTERVAL '90 days';

  DELETE FROM public.comment_processing_queue
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND status IN ('completed', 'failed');
END;
$$;

-- Run daily at 03:00 UTC, mirroring purge-closed-conversation-data
-- (migration 016) so retention jobs cluster off-peak.
SELECT cron.schedule(
  'purge-old-comment-data',
  '0 3 * * *',
  $$SELECT public.purge_old_comment_data()$$
);
