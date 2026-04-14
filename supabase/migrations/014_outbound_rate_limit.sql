-- Migration 014: Outbound DM rate limit (Meta policy: 200 DMs/hour/account)
-- Run this manually in the Supabase SQL editor.

-- Log table: one row per outbound DM. We purge rows > 24h old in the RPC to
-- keep the table small; `(user_id, sent_at desc)` index keeps the count fast.
CREATE TABLE IF NOT EXISTS public.outbound_dm_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outbound_dm_log_user_sent_at
  ON public.outbound_dm_log(user_id, sent_at DESC);

-- Atomic rate-limit check + record. Returns TRUE if we recorded a send (and
-- the caller should proceed); FALSE if the 200/hr cap has been hit.
-- 200 is Meta's documented ceiling for Instagram Messaging.
CREATE OR REPLACE FUNCTION public.check_and_record_outbound(uid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  recent_count INT;
BEGIN
  -- Purge rows older than 24h (runs only on each call, cheap thanks to the idx)
  DELETE FROM public.outbound_dm_log
  WHERE sent_at < NOW() - INTERVAL '24 hours'
    AND user_id = uid;

  SELECT COUNT(*) INTO recent_count
  FROM public.outbound_dm_log
  WHERE user_id = uid
    AND sent_at > NOW() - INTERVAL '1 hour';

  IF recent_count >= 200 THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.outbound_dm_log(user_id) VALUES (uid);
  RETURN TRUE;
END;
$$;

-- RLS: users shouldn't see their own log rows from the client; admin only.
ALTER TABLE public.outbound_dm_log ENABLE ROW LEVEL SECURITY;
-- Intentionally no public policies — only the service role (and the SECURITY
-- DEFINER RPC above) reads/writes this table.
