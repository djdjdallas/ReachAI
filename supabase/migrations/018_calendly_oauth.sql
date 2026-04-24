-- Migration 018: Calendly OAuth + per-user webhook signing keys
-- Run this manually in the Supabase SQL editor.
--
-- Replaces the shared CALENDLY_WEBHOOK_SECRET design with a per-user OAuth flow
-- where each connected user has their own encrypted tokens and their own webhook
-- signing key returned by Calendly when we register their subscription.

-- ── Section A: Calendly OAuth columns on users ───────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS calendly_access_token        TEXT,
  ADD COLUMN IF NOT EXISTS calendly_refresh_token       TEXT,
  ADD COLUMN IF NOT EXISTS calendly_token_expires_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS calendly_user_uri            TEXT,
  ADD COLUMN IF NOT EXISTS calendly_organization_uri    TEXT,
  ADD COLUMN IF NOT EXISTS calendly_webhook_uri         TEXT,
  ADD COLUMN IF NOT EXISTS calendly_webhook_signing_key TEXT;

-- Fast lookup when a webhook arrives and we need to find the owner by user URI.
CREATE INDEX IF NOT EXISTS idx_users_calendly_user_uri
  ON public.users(calendly_user_uri)
  WHERE calendly_user_uri IS NOT NULL;

-- ── Section B: Calendly invitee URI on bookings ──────────────────────────

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS calendly_invitee_uri TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_calendly_invitee_uri
  ON public.bookings(calendly_invitee_uri)
  WHERE calendly_invitee_uri IS NOT NULL;
