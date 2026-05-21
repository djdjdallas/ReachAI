-- Voice Replies v1 — schema for Unlimited-plan voice reply library plus
-- the intent_classification column that the new DM intent classifier
-- (src/lib/dm-intent.js) writes on every inbound message.

-- ── users.voice_replies_enabled ────────────────────────────────────────
-- Per-user kill switch. Lets us disable the voice path for the Meta App
-- Review test account (highflyinnick@gmail.com) without removing the
-- feature for everyone, and gives us a fast incident-response lever
-- post-launch if a coach's voice library starts misfiring.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS voice_replies_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.users.voice_replies_enabled IS
  'Per-user kill switch for the voice replies feature. Default true. Set false to disable for the Meta App Review test account and for post-launch incident response.';

-- ── messages.intent_classification ─────────────────────────────────────
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS intent_classification JSONB;

COMMENT ON COLUMN public.messages.intent_classification IS
  'DM intent classifier output for this message (class, confidence, language, reasoning, signals). Only populated on inbound messages with role=''user''. Used for voice routing and future Inbox Insights reporting on the Unlimited plan.';

-- ── voice_snippets ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.voice_snippets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  intent_class TEXT NOT NULL,
  label TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0 AND duration_ms <= 90000),
  mime_type TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 5242880),
  transcript TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  send_count INTEGER NOT NULL DEFAULT 0,
  consent_acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS voice_snippets_active_per_class
  ON public.voice_snippets (user_id, intent_class)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS voice_snippets_user_id_idx
  ON public.voice_snippets (user_id);

DROP TRIGGER IF EXISTS update_voice_snippets_updated_at ON public.voice_snippets;
CREATE TRIGGER update_voice_snippets_updated_at
  BEFORE UPDATE ON public.voice_snippets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.voice_snippets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "voice_snippets_select_own" ON public.voice_snippets;
CREATE POLICY "voice_snippets_select_own"
  ON public.voice_snippets FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "voice_snippets_insert_own" ON public.voice_snippets;
CREATE POLICY "voice_snippets_insert_own"
  ON public.voice_snippets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "voice_snippets_update_own" ON public.voice_snippets;
CREATE POLICY "voice_snippets_update_own"
  ON public.voice_snippets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "voice_snippets_delete_own" ON public.voice_snippets;
CREATE POLICY "voice_snippets_delete_own"
  ON public.voice_snippets FOR DELETE
  USING (auth.uid() = user_id);

-- ── voice_send_log ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.voice_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  voice_snippet_id UUID REFERENCES public.voice_snippets(id) ON DELETE SET NULL,
  conversation_id UUID,
  recipient_psid TEXT NOT NULL,
  intent_class TEXT NOT NULL,
  send_status TEXT NOT NULL CHECK (send_status IN (
    'sent',
    'failed',
    'fallback_text',
    'skipped_kill_switch',
    'skipped_do_not_send'
  )),
  error_message TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS voice_send_log_user_id_sent_at_idx
  ON public.voice_send_log (user_id, sent_at DESC);

ALTER TABLE public.voice_send_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "voice_send_log_select_own" ON public.voice_send_log;
CREATE POLICY "voice_send_log_select_own"
  ON public.voice_send_log FOR SELECT
  USING (auth.uid() = user_id);

-- ── increment_voice_send_count RPC ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_voice_send_count(snippet_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.voice_snippets
  SET send_count = send_count + 1
  WHERE id = snippet_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_voice_send_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_voice_send_count(UUID) TO service_role;

-- ── Manual post-apply step (run BEFORE uploading any voice snippets) ───
-- Disable voice replies for the Meta App Review test account.
-- Run BEFORE uploading any voice snippets on any account.
-- UPDATE public.users SET voice_replies_enabled = false WHERE email = 'highflyinnick@gmail.com';
