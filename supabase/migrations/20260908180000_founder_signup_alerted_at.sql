-- Atomic once-only claim for the founder signup alert.
--
-- The claim moves from auth.users app_metadata (updateUserById — no
-- compare-and-set, so a failed send could never be released for retry
-- without risking duplicate alerts under concurrent /onboarding renders)
-- to a conditional UPDATE on this column, the same race-safe shape as
-- meta_reconnect_required's runtime flag. NULL = not yet alerted; the
-- render that flips NULL -> now() owns the send and releases the claim
-- (back to NULL) if Resend rejects it.
--
-- Backfill marks every user created before this migration as alerted, so
-- nobody who already got an alert via the old app_metadata flag alerts
-- again. The pinned cutoff makes a re-run safe: it can never swallow the
-- pending alert of a user who signed up after the migration shipped.
-- Reversible by dropping the column.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS founder_signup_alerted_at TIMESTAMPTZ DEFAULT NULL;

UPDATE public.users
SET founder_signup_alerted_at = COALESCE(founder_signup_alerted_at, now())
WHERE founder_signup_alerted_at IS NULL
  AND created_at < '2026-09-08T18:00:00Z';
