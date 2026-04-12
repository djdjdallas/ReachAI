-- Migration 010: Notification preferences + email event log
-- Run this manually in the Supabase SQL editor.

-- Notification preferences on users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS notify_hot_leads_email BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_bookings_email BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_hot_leads_sms BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_bookings_sms BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS drip_enrolled_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS drip_step INTEGER DEFAULT 0;

-- Email event log for drip deduplication and analytics
CREATE TABLE IF NOT EXISTS public.email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'drip_step_1', 'drip_step_2', 'hot_lead_alert', 'booking_alert'
  metadata JSONB DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_events_user_id ON public.email_events(user_id);
CREATE INDEX IF NOT EXISTS idx_email_events_event_type ON public.email_events(user_id, event_type);

ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own email events"
  ON public.email_events FOR SELECT
  USING (auth.uid() = user_id);
