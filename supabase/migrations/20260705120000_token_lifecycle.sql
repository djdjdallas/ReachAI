-- Token lifecycle & self-healing refresh (Phase 2)
--
-- Adds reconnect tracking next to the EXISTING encrypted token columns
-- (meta_* / calendly_* / google_calendar_*). No new tables, and deliberately NO
-- new plaintext token columns — tokens stay encrypted at rest via
-- encryptToken()/decryptToken().
--
-- The daily /api/cron/refresh-tokens cron proactively refreshes tokens before
-- they expire. It sets *_reconnect_required = true ONLY when the provider
-- returns a definitive auth error (Meta OAuthException/code 190, or
-- Calendly/Google invalid_grant / 400 / 401) — i.e. the token is truly dead and
-- the coach must re-authorize. Transient failures (5xx, rate limit, network)
-- never flag. A successful refresh clears the flag. The reconnect banner and
-- /api/alerts/token-health read these flags as the authoritative signal.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS meta_token_refreshed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS meta_reconnect_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS meta_reconnect_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS calendly_reconnect_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS calendly_reconnect_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS google_calendar_reconnect_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS google_calendar_reconnect_notified_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.meta_reconnect_required IS
  'Set true by /api/cron/refresh-tokens when Meta returns OAuthException/code 190 (Instagram token truly dead — coach must re-auth). Cleared on successful refresh. Gates the reconnect banner + token-health.';

COMMENT ON COLUMN public.users.meta_token_refreshed_at IS
  'Timestamp of the last successful Meta long-lived token refresh. Used to enforce Meta''s 24h minimum-age rule (refresh_access_token rejects tokens younger than 24h).';

COMMENT ON COLUMN public.users.calendly_reconnect_required IS
  'Set true by the refresh cron when the Calendly refresh token is revoked/invalid (invalid_grant / 400 / 401). Cleared on successful refresh.';

COMMENT ON COLUMN public.users.google_calendar_reconnect_required IS
  'Set true by the refresh cron when the Google refresh token is revoked/invalid (invalid_grant). Cleared on successful refresh.';
