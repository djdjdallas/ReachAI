-- Migration: Instagram voice-profile auto-import tracker
--
-- Adds:
--   users.instagram_auto_import_attempted_at — timestamp the post-OAuth
--                                              voice-profile auto-import
--                                              has been attempted.
--
-- Set on both success and failure to guarantee single-attempt semantics
-- and prevent retry loops. The auto-profile endpoint stamps this column
-- BEFORE doing any work so a crash mid-flight cannot cause re-entry.
-- NULL means we have never tried; non-NULL means we have tried at least
-- once and should not auto-retry.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS instagram_auto_import_attempted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.instagram_auto_import_attempted_at IS
  'Set when the post-OAuth voice profile auto-import has been attempted. '
  'Set on both success and failure to prevent retry loops. Never null '
  'means we have tried at least once.';
