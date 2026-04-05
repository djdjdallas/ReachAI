-- Migration 006: Extend bookings table for Calendly webhooks + Google Calendar integration
-- Run this manually in the Supabase SQL editor.

-- ── Section A: Make conversation_id nullable ─────────────────────────────
-- Calendly webhooks may create bookings that can't be matched to a conversation.

ALTER TABLE public.bookings
  ALTER COLUMN conversation_id DROP NOT NULL;

-- ── Section B: Add Calendly and scheduling columns to bookings ───────────

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS invitee_name TEXT,
  ADD COLUMN IF NOT EXISTS invitee_email TEXT,
  ADD COLUMN IF NOT EXISTS event_name TEXT,
  ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS calendly_event_uri TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'confirmed',
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add check constraint for status values
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('confirmed', 'canceled', 'rescheduled'));

-- Unique constraint on calendly_event_uri (only when not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_calendly_event_uri
  ON public.bookings(calendly_event_uri)
  WHERE calendly_event_uri IS NOT NULL;

-- ── Section C: Backfill existing rows ────────────────────────────────────

UPDATE public.bookings
SET
  start_time = COALESCE(booked_at, created_at),
  status = 'confirmed',
  source = 'manual'
WHERE start_time IS NULL;

-- ── Section D: Additional indexes ────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_bookings_start_time
  ON public.bookings(start_time);

CREATE INDEX IF NOT EXISTS idx_bookings_conversation_id
  ON public.bookings(conversation_id);

-- ── Section E: Auto-update updated_at trigger ────────────────────────────

CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ── Section F: Google Calendar columns on users table ────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS google_calendar_access_token TEXT,
  ADD COLUMN IF NOT EXISTS google_calendar_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS google_calendar_token_expires_at TIMESTAMPTZ;
