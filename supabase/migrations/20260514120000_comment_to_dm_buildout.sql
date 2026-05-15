-- Migration: Comment-to-DM Shadow Mode Buildout
--
-- Adds the four shadow-mode tables that the audit flagged as missing
-- (post_monitoring_settings, dm_templates, comment_to_dm_log,
-- comment_processing_queue), plus a deprecated_at column on creator_offers
-- to support a "single active offer per creator" rollout, plus a partial
-- unique index on comment_classifications.ig_comment_id for webhook dedup.
--
-- All four new tables enable RLS scoped to auth.uid() = creator_id, matching
-- the convention established in 20260420120000_intent_classifier_shadow.sql.
-- Writes happen via service-role keys in server routes; the policies exist so
-- that any future client-side reads remain safe by default.

-- ── creator_offers: deprecated_at ──────────────────────────────────────────
-- The shadow playground previously upserted by (creator_id, offer_name),
-- which let a single creator accumulate multiple offers. The new offer
-- authoring UI keys by creator_id only; older rows are soft-deprecated so
-- bundle history stays intact.
ALTER TABLE public.creator_offers
  ADD COLUMN IF NOT EXISTS deprecated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_creator_offers_active
  ON public.creator_offers(creator_id, updated_at DESC)
  WHERE deprecated_at IS NULL;

-- ── post_monitoring_settings ───────────────────────────────────────────────
-- Per-post opt-in for comment-to-DM monitoring plus a per-class action map.
-- actions_per_class shape:
--   { "HIGH_INTENT": "dm",
--     "ENGAGED_NOT_BUYING": "queue_review",
--     "NOT_A_LEAD": "ignore",
--     ... }
-- Falls back to project-wide defaults in src/lib/comment-trigger-rules.js
-- when a post has no row here.
CREATE TABLE IF NOT EXISTS public.post_monitoring_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  actions_per_class JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (creator_id, post_id)
);
CREATE INDEX IF NOT EXISTS idx_post_monitoring_settings_creator
  ON public.post_monitoring_settings(creator_id);

ALTER TABLE public.post_monitoring_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_monitoring_select_own"
  ON public.post_monitoring_settings FOR SELECT
  USING (auth.uid() = creator_id);
CREATE POLICY "post_monitoring_insert_own"
  ON public.post_monitoring_settings FOR INSERT
  WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "post_monitoring_update_own"
  ON public.post_monitoring_settings FOR UPDATE
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "post_monitoring_delete_own"
  ON public.post_monitoring_settings FOR DELETE
  USING (auth.uid() = creator_id);

-- ── dm_templates ───────────────────────────────────────────────────────────
-- Per-creator DM copy keyed by intent class. intent_class is a free-text
-- column (not a Postgres enum) so the taxonomy can evolve in
-- src/lib/classifier.js without a schema migration. The trigger-rules
-- module is the source of truth for which class names are valid.
CREATE TABLE IF NOT EXISTS public.dm_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  intent_class TEXT NOT NULL,
  template TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (creator_id, intent_class)
);
CREATE INDEX IF NOT EXISTS idx_dm_templates_creator
  ON public.dm_templates(creator_id);

ALTER TABLE public.dm_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dm_templates_select_own"
  ON public.dm_templates FOR SELECT
  USING (auth.uid() = creator_id);
CREATE POLICY "dm_templates_insert_own"
  ON public.dm_templates FOR INSERT
  WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "dm_templates_update_own"
  ON public.dm_templates FOR UPDATE
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "dm_templates_delete_own"
  ON public.dm_templates FOR DELETE
  USING (auth.uid() = creator_id);

-- ── comment_to_dm_log ──────────────────────────────────────────────────────
-- Audit trail of decideAction() outcomes. In shadow mode dispatched is
-- always FALSE — rendered_dm captures what WOULD have been sent so the
-- founder can review. Required for Meta App Review evidence once we
-- request instagram_manage_comments.
CREATE TABLE IF NOT EXISTS public.comment_to_dm_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_classification_id UUID NOT NULL
    REFERENCES public.comment_classifications(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  decided_action TEXT NOT NULL,
  rendered_dm TEXT,
  dispatched BOOLEAN NOT NULL DEFAULT FALSE,
  simulated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comment_to_dm_log_creator_time
  ON public.comment_to_dm_log(creator_id, simulated_at DESC);
CREATE INDEX IF NOT EXISTS idx_comment_to_dm_log_classification
  ON public.comment_to_dm_log(comment_classification_id);

ALTER TABLE public.comment_to_dm_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comment_to_dm_log_select_own"
  ON public.comment_to_dm_log FOR SELECT
  USING (auth.uid() = creator_id);
CREATE POLICY "comment_to_dm_log_insert_own"
  ON public.comment_to_dm_log FOR INSERT
  WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "comment_to_dm_log_update_own"
  ON public.comment_to_dm_log FOR UPDATE
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "comment_to_dm_log_delete_own"
  ON public.comment_to_dm_log FOR DELETE
  USING (auth.uid() = creator_id);

-- ── comment_processing_queue ───────────────────────────────────────────────
-- Async work queue for the eventual webhook-driven pipeline. Schema only;
-- no worker yet (deferred). status is free-text so we can introduce new
-- states (e.g. 'rate_limited') without a migration.
CREATE TABLE IF NOT EXISTS public.comment_processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_classification_id UUID NOT NULL
    REFERENCES public.comment_classifications(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  action TEXT,
  payload JSONB,
  attempts INT NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_comment_processing_queue_poll
  ON public.comment_processing_queue(creator_id, status, created_at);

ALTER TABLE public.comment_processing_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comment_processing_queue_select_own"
  ON public.comment_processing_queue FOR SELECT
  USING (auth.uid() = creator_id);
CREATE POLICY "comment_processing_queue_insert_own"
  ON public.comment_processing_queue FOR INSERT
  WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "comment_processing_queue_update_own"
  ON public.comment_processing_queue FOR UPDATE
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "comment_processing_queue_delete_own"
  ON public.comment_processing_queue FOR DELETE
  USING (auth.uid() = creator_id);

-- ── comment_classifications dedup ──────────────────────────────────────────
-- Webhook redeliveries from Meta would otherwise produce duplicate rows.
-- Partial unique index lets shadow-mode rows (ig_comment_id IS NULL) coexist
-- without contention while real ingestion remains idempotent per creator.
CREATE UNIQUE INDEX IF NOT EXISTS idx_classifications_dedup
  ON public.comment_classifications(creator_id, ig_comment_id)
  WHERE ig_comment_id IS NOT NULL;
