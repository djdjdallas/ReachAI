-- Migration 016: 7-day message retention for closed conversations.
-- Run this manually in the Supabase SQL editor. Requires pg_cron
-- (already enabled in migration 004 for the DM counter reset).
--
-- Privacy policy commits to retaining message data only as long as is
-- needed for conversation context. "Booked" and "not_a_fit" conversations
-- are closed — we keep a shell of the conversation + aggregated status
-- for analytics, but the actual message content and sender_name are
-- purged after 7 days.
--
-- Active conversations (status in 'qualifying', 'interested', 'manual')
-- retain full history so the AI keeps context for follow-up.

CREATE OR REPLACE FUNCTION public.purge_closed_conversation_data()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.messages
  WHERE conversation_id IN (
    SELECT id FROM public.conversations
    WHERE status IN ('booked', 'not_a_fit')
      AND COALESCE(last_message_at, updated_at) < NOW() - INTERVAL '7 days'
  );

  UPDATE public.conversations
  SET sender_name = NULL
  WHERE status IN ('booked', 'not_a_fit')
    AND COALESCE(last_message_at, updated_at) < NOW() - INTERVAL '7 days'
    AND sender_name IS NOT NULL;
END;
$$;

-- Run daily at 03:00 UTC.
SELECT cron.schedule(
  'purge-closed-conversation-data',
  '0 3 * * *',
  $$SELECT public.purge_closed_conversation_data()$$
);
