-- Drip Sequences v1 (Version A: in-window nudges) — schema for the Unlimited-
-- plan follow-up nudge feature. Sends ONE follow-up DM to a quiet lead BEFORE
-- Instagram's 24-hour messaging window closes. Deploys DARK: drip_enabled
-- defaults to false for every user (including the founder) until explicit
-- opt-in via /drip-sequences.
--
-- Meta-policy notes baked into the schema:
--   - drip_delay_hours CHECK (6-22) makes it impossible to schedule a nudge
--     outside the 24-hour window (the processor adds a further 23.5h safety
--     check at fire time).
--   - One nudge per conversation, ever — enforced by a partial unique index on
--     dm_drip_queue across the non-terminal ('scheduled','processing') states.

-- ── users: per-user controls ───────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS drip_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.drip_enabled IS
  'Master kill switch for in-window follow-up nudges. Default false (deploy-dark). No drip is enqueued or fired while this is false, for any user including the founder. Flipped false on plan downgrade by the Stripe webhook.';

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS drip_delay_hours INTEGER NOT NULL DEFAULT 18
  CHECK (drip_delay_hours >= 6 AND drip_delay_hours <= 22);

COMMENT ON COLUMN public.users.drip_delay_hours IS
  'Hours of lead silence before a follow-up nudge fires. CHECK 6-22 keeps every scheduled nudge strictly inside Instagram''s 24-hour messaging window. Default 18 leaves a 6-hour buffer before window expiry.';

-- ── messages.source: allow 'drip' ──────────────────────────────────────
-- Lets the inbox visually distinguish a follow-up nudge from a regular AI
-- reply ('agent') or a voice reply. Mirrors how 'native_send' was added in
-- 20260518120000_native_send_outbound.sql.
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_source_check;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_source_check
  CHECK (source IN ('lead', 'agent', 'manual', 'native_send', 'drip'));

-- ── dm_drip_templates ──────────────────────────────────────────────────
-- The coach-authored follow-up nudge per intent class. Mirrors voice_snippets:
-- one active template per (user_id, intent_class) at a time.
CREATE TABLE IF NOT EXISTS public.dm_drip_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  intent_class TEXT NOT NULL
    CHECK (intent_class IN (
      'warm_intent',
      'objection_price',
      'objection_time',
      'objection_trust',
      'booking_cta',
      'follow_up'
    )),
  label TEXT NOT NULL,
  content TEXT NOT NULL CHECK (length(content) >= 10 AND length(content) <= 1000),
  is_active BOOLEAN NOT NULL DEFAULT true,
  send_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One active template per intent class per coach.
CREATE UNIQUE INDEX IF NOT EXISTS dm_drip_templates_active_per_class
  ON public.dm_drip_templates (user_id, intent_class)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS dm_drip_templates_user_id_idx
  ON public.dm_drip_templates (user_id);

-- ── dm_drip_queue ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dm_drip_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  recipient_psid TEXT NOT NULL,
  intent_class TEXT NOT NULL,
  template_id UUID REFERENCES public.dm_drip_templates(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'processing', 'fired', 'canceled', 'skipped', 'expired')),
  skip_reason TEXT,
  fired_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CRITICAL: one drip per conversation across all non-terminal states. The
-- terminal states (fired/canceled/skipped/expired) are intentionally excluded
-- so a future reactivation of the same conversation can be re-scheduled.
CREATE UNIQUE INDEX IF NOT EXISTS drip_queue_one_active_per_conversation
  ON public.dm_drip_queue (conversation_id)
  WHERE status IN ('scheduled', 'processing');

-- Cron query: find due, still-scheduled drips fast.
CREATE INDEX IF NOT EXISTS drip_queue_due_idx
  ON public.dm_drip_queue (scheduled_at)
  WHERE status = 'scheduled';

-- Analytics / per-user history.
CREATE INDEX IF NOT EXISTS drip_queue_user_status_idx
  ON public.dm_drip_queue (user_id, status, fired_at DESC);

-- ── updated_at triggers (reuse the existing update_updated_at fn) ───────
DROP TRIGGER IF EXISTS update_dm_drip_templates_updated_at ON public.dm_drip_templates;
CREATE TRIGGER update_dm_drip_templates_updated_at
  BEFORE UPDATE ON public.dm_drip_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_dm_drip_queue_updated_at ON public.dm_drip_queue;
CREATE TRIGGER update_dm_drip_queue_updated_at
  BEFORE UPDATE ON public.dm_drip_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────
ALTER TABLE public.dm_drip_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dm_drip_templates_select_own" ON public.dm_drip_templates;
CREATE POLICY "dm_drip_templates_select_own"
  ON public.dm_drip_templates FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "dm_drip_templates_insert_own" ON public.dm_drip_templates;
CREATE POLICY "dm_drip_templates_insert_own"
  ON public.dm_drip_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "dm_drip_templates_update_own" ON public.dm_drip_templates;
CREATE POLICY "dm_drip_templates_update_own"
  ON public.dm_drip_templates FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "dm_drip_templates_delete_own" ON public.dm_drip_templates;
CREATE POLICY "dm_drip_templates_delete_own"
  ON public.dm_drip_templates FOR DELETE
  USING (auth.uid() = user_id);

ALTER TABLE public.dm_drip_queue ENABLE ROW LEVEL SECURITY;

-- Queue rows are written server-side via the service role only. Coaches get
-- read access (to render "follow-up scheduled" badges); all writes bypass RLS
-- through getSupabaseAdmin().
DROP POLICY IF EXISTS "dm_drip_queue_select_own" ON public.dm_drip_queue;
CREATE POLICY "dm_drip_queue_select_own"
  ON public.dm_drip_queue FOR SELECT
  USING (auth.uid() = user_id);

-- ── claim_due_drips RPC (atomic batch claim for the cron) ───────────────
-- FOR UPDATE SKIP LOCKED makes overlapping cron invocations safe: each row is
-- claimed by exactly one worker, the other skips it.
CREATE OR REPLACE FUNCTION public.claim_due_drips(batch_size INTEGER DEFAULT 50)
RETURNS SETOF public.dm_drip_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.dm_drip_queue
  SET status = 'processing', updated_at = now()
  WHERE id IN (
    SELECT id FROM public.dm_drip_queue
    WHERE status = 'scheduled' AND scheduled_at <= now()
    ORDER BY scheduled_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_due_drips(INTEGER) TO service_role;

-- ── increment_drip_send_count RPC ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_drip_send_count(template_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.dm_drip_templates SET send_count = send_count + 1 WHERE id = template_id;
$$;

GRANT EXECUTE ON FUNCTION public.increment_drip_send_count(UUID) TO service_role;

-- ── Post-apply verification (deploy-dark guarantee) ─────────────────────
-- After applying: verify no users have drip_enabled = true.
-- Drip should default to OFF for all users including the founder
-- until explicit opt-in via /drip-sequences.
--   SELECT email FROM public.users WHERE drip_enabled = true;  -- expect 0 rows
-- Emergency global disable:
--   UPDATE public.users SET drip_enabled = false;
