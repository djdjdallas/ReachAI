-- Migration: add 'inbound' as a valid conversations.origin value
--
-- Bug context (inbound-DM misclassification):
--   conversations.origin was added in 20260518120000 with
--   DEFAULT 'clinchd_sent' and CHECK (origin IN ('clinchd_sent','native_send')).
--   That default assumes EVERY conversation is outbound-initiated. A genuine
--   inbound DM (a lead messages the coach first) was therefore created with
--   origin='clinchd_sent', which made the webhook flag it
--   missing_outbound_context=true and fire the orange "paste the DM you sent"
--   backfill banner on a thread the coach never initiated.
--
--   The webhook now writes origin='inbound' explicitly when a conversation is
--   born from an inbound DM (see src/app/api/webhooks/instagram/route.js).
--   This migration extends the CHECK constraint so that value is accepted.
--   The column DEFAULT stays 'clinchd_sent' (the /api/outreach/start "New
--   outreach" flow still relies on it).
--
-- Idempotent: drops the existing named CHECK before re-adding the widened one.
-- Running twice produces the same end state with no error.

BEGIN;

ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_origin_check;

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_origin_check
  CHECK (origin IN ('clinchd_sent', 'native_send', 'inbound'));

COMMIT;
