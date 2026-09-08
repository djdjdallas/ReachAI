-- Rename the skip reason 'no_greeting' -> 'greeting_not_configured'.
--
-- The old name read as "the lead didn't say hello". The gate it records
-- (webhooks/instagram/route.js, SKIP.GREETING_NOT_CONFIGURED) actually
-- means the COACH has no opening line saved in script_config — it says
-- nothing about the lead's message, and the old name misled two readers
-- in one day.
--
-- Data-only backfill; no schema change. Idempotent: a second run matches
-- zero rows. Reversible with the inverse UPDATE, with one caveat — after
-- the renamed code deploys, new rows are written as
-- 'greeting_not_configured' directly, so a reversal would also rename
-- those newer rows to the old value.

UPDATE public.conversations
SET last_skip_reason = 'greeting_not_configured'
WHERE last_skip_reason = 'no_greeting';
