-- Migration 015: Per-user AI endpoint rate limit (prevents Anthropic cost abuse)
-- Run this manually in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.ai_call_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  called_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_call_log_user_endpoint_called
  ON public.ai_call_log(user_id, endpoint, called_at DESC);

-- Atomic check + record. Returns TRUE if the call is allowed and was logged,
-- FALSE if the per-hour cap has been hit for this user+endpoint.
CREATE OR REPLACE FUNCTION public.check_ai_rate(
  uid UUID,
  ep TEXT,
  max_per_hour INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  recent_count INT;
BEGIN
  DELETE FROM public.ai_call_log
  WHERE called_at < NOW() - INTERVAL '24 hours'
    AND user_id = uid;

  SELECT COUNT(*) INTO recent_count
  FROM public.ai_call_log
  WHERE user_id = uid
    AND endpoint = ep
    AND called_at > NOW() - INTERVAL '1 hour';

  IF recent_count >= max_per_hour THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.ai_call_log(user_id, endpoint) VALUES (uid, ep);
  RETURN TRUE;
END;
$$;

ALTER TABLE public.ai_call_log ENABLE ROW LEVEL SECURITY;
-- No public policies — SECURITY DEFINER RPC + service role only.
