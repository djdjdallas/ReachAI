-- Migration: comment_to_dm_log decision-trail columns
--
-- Phase 1 of the comment-to-DM rollout writes a row per classification
-- with the decision decideAction() returned. Adds decided_at so the
-- audit trail captures when the decision was made (distinct from
-- simulated_at, which the original buildout used for the legacy admin
-- playground simulation timestamp).
--
-- decided_action already exists on comment_to_dm_log (NOT NULL TEXT, see
-- 20260514120000_comment_to_dm_buildout.sql). The IF NOT EXISTS guard
-- makes this migration idempotent — re-running on an environment that
-- already has the column is a no-op.

ALTER TABLE public.comment_to_dm_log
  ADD COLUMN IF NOT EXISTS decided_action TEXT,
  ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ DEFAULT NOW();
