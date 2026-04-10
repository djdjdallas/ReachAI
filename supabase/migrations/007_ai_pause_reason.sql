-- Track WHY the AI was paused on a conversation so the dashboard can
-- distinguish manual-takeover pauses from auto-pauses triggered by the
-- human-in-loop complex-objection classifier.

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS ai_pause_reason TEXT DEFAULT NULL;

COMMENT ON COLUMN public.conversations.ai_pause_reason IS
  'null | manual | complex_objection | low_confidence — populated when ai_paused = true';
