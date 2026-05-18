-- Migration: comment_to_dm_log dispatch outcome columns
--
-- Phase 2 of the comment-to-DM rollout wires sendPrivateReplyToComment().
-- These columns record what happened when we tried to dispatch:
--   - dispatched_at: when the Graph API call returned success
--   - dispatched_message_id: the message id Meta returned (for support /
--     audit traceability against the Meta App Dashboard)
--   - dispatch_error: short failure reason (e.g. "stale_comment",
--     "self_comment", "rate_limited", "dm_no_template", "dm_stale")
--   - dispatch_retryable: tracks whether a future queue worker (Phase 3+)
--     could re-attempt this dispatch
--
-- Idempotent: all guards use IF NOT EXISTS so this re-runs safely.

ALTER TABLE public.comment_to_dm_log
  ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispatched_message_id TEXT,
  ADD COLUMN IF NOT EXISTS dispatch_error TEXT,
  ADD COLUMN IF NOT EXISTS dispatch_retryable BOOLEAN;
