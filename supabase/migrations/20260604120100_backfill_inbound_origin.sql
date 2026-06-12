-- Migration: backfill inbound-initiated conversations mislabeled as outbound
--
-- Bug context (inbound-DM misclassification):
--   Because conversations.origin defaulted to 'clinchd_sent', every conversation
--   created from a genuine inbound DM was mislabeled as outbound-initiated and
--   flagged missing_outbound_context=true, firing the orange backfill banner on
--   threads the coach never started. The webhook is now fixed to write
--   origin='inbound' on inbound creation; this migration repairs the rows that
--   were already written wrong.
--
-- Affected rows (audit count at write time: 6), identified by ALL of:
--   - origin = 'clinchd_sent'
--   - missing_outbound_context = true
--   - the FIRST message (oldest created_at) has role = 'user' (lead spoke first)
--   - NO native_send_outbound row is matched to the conversation
--     (i.e. this was never a real native cold-DM outreach the coach pre-logged)
--   To inspect them before/after, run scripts/review-paused-conversations.mjs.
--
-- What this DOES:    sets origin='inbound', missing_outbound_context=false
-- What this does NOT: it deliberately does NOT touch ai_paused or
--   ai_pause_reason. The do_not_send classifier pause is an INDEPENDENT,
--   correctly-functioning system — some of these may have been paused for a
--   legitimate reason. Dom reviews and unpauses each one manually.
--
-- Idempotent: after the update the rows have origin='inbound', so they no
-- longer satisfy the origin='clinchd_sent' predicate. A second run matches
-- zero rows and raises "0".

BEGIN;

DO $$
DECLARE
  v_count integer;
BEGIN
  WITH first_msg AS (
    SELECT DISTINCT ON (m.conversation_id)
           m.conversation_id,
           m.role
    FROM public.messages m
    ORDER BY m.conversation_id, m.created_at ASC
  ),
  targets AS (
    SELECT c.id
    FROM public.conversations c
    JOIN first_msg fm ON fm.conversation_id = c.id
    WHERE c.origin = 'clinchd_sent'
      AND c.missing_outbound_context = true
      AND fm.role = 'user'
      AND NOT EXISTS (
        SELECT 1 FROM public.native_send_outbound n
        WHERE n.matched_conversation_id = c.id
      )
  )
  UPDATE public.conversations c
  SET origin = 'inbound',
      missing_outbound_context = false
  FROM targets t
  WHERE c.id = t.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'backfill_inbound_origin: corrected % conversation(s) to origin=inbound (ai_paused untouched)', v_count;
END $$;

COMMIT;
