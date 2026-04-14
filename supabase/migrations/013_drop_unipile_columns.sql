-- Migration 013: Drop legacy Unipile columns
-- Run this manually in the Supabase SQL editor AFTER confirming no code
-- path still reads from these columns (as of 2026-04-14 the removal is
-- tracked in the production audit plan — src/lib/unipile.js is deleted
-- and onboarding/page.js no longer checks unipile_account_id).
--
-- If you still need historical Unipile data for backfill/audit, do NOT
-- run this migration — just leave the columns in place; nothing reads
-- them anymore.

ALTER TABLE public.users
  DROP COLUMN IF EXISTS unipile_account_id,
  DROP COLUMN IF EXISTS unipile_provider,
  DROP COLUMN IF EXISTS unipile_access_token,
  DROP COLUMN IF EXISTS unipile_refresh_token,
  DROP COLUMN IF EXISTS unipile_account_status;
