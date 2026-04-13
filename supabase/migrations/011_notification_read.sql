-- Migration 011: Add read_at column to email_events for in-app notification tracking
-- Run this manually in the Supabase SQL editor.

ALTER TABLE public.email_events
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ DEFAULT NULL;

-- Partial index for fast unread-per-user queries
CREATE INDEX IF NOT EXISTS idx_email_events_user_unread
  ON public.email_events(user_id, read_at) WHERE read_at IS NULL;

-- Allow users to mark their own notifications as read
CREATE POLICY "Users can update own email events"
  ON public.email_events FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
