-- 022_drop_conversation_force_agent.sql
--
-- Drops the `force_agent` column added by migration 020. The
-- not_outreach_initiated gate it was an escape hatch for has been
-- removed (see 021), so the column has no readers and the API endpoint
-- that wrote it has been deleted.

ALTER TABLE public.conversations DROP COLUMN force_agent;
