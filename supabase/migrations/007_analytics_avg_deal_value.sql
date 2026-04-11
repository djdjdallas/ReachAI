-- Migration 007: Add avg_deal_value to users for real Analytics revenue
-- Run this manually in the Supabase SQL editor.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avg_deal_value NUMERIC(12, 2);

COMMENT ON COLUMN public.users.avg_deal_value IS
  'User-configured average deal value (USD). Used by /analytics to compute revenue as bookings * avg_deal_value. NULL = not configured, revenue KPIs hidden.';
