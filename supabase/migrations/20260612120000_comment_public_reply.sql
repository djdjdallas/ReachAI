-- Migration: Optional public comment replies (comment-to-DM follow-on)
--
-- Adds the schema for posting a PUBLIC reply under a trigger comment after
-- the comment-to-DM private reply succeeds. Exists primarily so the
-- instagram_business_manage_comments App Review screencast can demonstrate
-- the public-reply half of the permission (rejected twice for not showing
-- it), and secondarily as an opt-in conversion nudge for coaches.
--
-- Safety posture (the part Meta's spam classifier cares about):
--   * users.comment_public_reply_enabled is NOT NULL DEFAULT FALSE — the
--     feature is OFF for every existing and future user until they opt in.
--   * Replies are drawn from a per-user pool (comment_reply_templates),
--     never a single fixed string.
--   * post_monitoring_settings.last_public_reply_text records the most
--     recent reply per post so the picker never posts the same text twice
--     in a row on the same post.
--
-- Anti-repeat tracking lives as a column on post_monitoring_settings rather
-- than a new comment_reply_log table because post_monitoring_settings is
-- already THE row that represents "this post's comment automation"
-- (UNIQUE (creator_id, post_id)) and the webhook loads it before any
-- dispatch — so reading the last reply costs zero extra queries and there
-- is no per-post log table to retain/prune.
--
-- NO template rows are seeded. Default state = feature off, zero templates.

-- ── users: per-user kill switch (OFF by default) ───────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS comment_public_reply_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- ── post_monitoring_settings: anti-repeat tracking ─────────────────────────
ALTER TABLE public.post_monitoring_settings
  ADD COLUMN IF NOT EXISTS last_public_reply_text TEXT;

-- ── comment_reply_templates ────────────────────────────────────────────────
-- The per-user pool of public-reply phrasings. The webhook picks a random
-- ACTIVE row whose text differs from the post's last_public_reply_text.
CREATE TABLE IF NOT EXISTS public.comment_reply_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reply_text TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comment_reply_templates_user_active
  ON public.comment_reply_templates(user_id)
  WHERE is_active = TRUE;

-- RLS scoped to auth.uid() = user_id, matching the convention from
-- 20260514120000_comment_to_dm_buildout.sql. Writes happen via service-role
-- keys in server routes; the policies keep any future client-side access
-- safe by default. DROP-then-CREATE keeps the migration idempotent
-- (Postgres has no CREATE POLICY IF NOT EXISTS).
ALTER TABLE public.comment_reply_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comment_reply_templates_select_own" ON public.comment_reply_templates;
CREATE POLICY "comment_reply_templates_select_own"
  ON public.comment_reply_templates FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "comment_reply_templates_insert_own" ON public.comment_reply_templates;
CREATE POLICY "comment_reply_templates_insert_own"
  ON public.comment_reply_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "comment_reply_templates_update_own" ON public.comment_reply_templates;
CREATE POLICY "comment_reply_templates_update_own"
  ON public.comment_reply_templates FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "comment_reply_templates_delete_own" ON public.comment_reply_templates;
CREATE POLICY "comment_reply_templates_delete_own"
  ON public.comment_reply_templates FOR DELETE
  USING (auth.uid() = user_id);

-- Post-migration sanity check (run manually):
--   SELECT count(*) FROM public.users WHERE comment_public_reply_enabled = true;  -- expect 0
--   SELECT count(*) FROM public.comment_reply_templates;                          -- expect 0
