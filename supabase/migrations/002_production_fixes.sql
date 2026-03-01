-- Fix 10: Add response_delay column to users table
-- Controls how long the AI waits before replying (in seconds)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS response_delay INTEGER DEFAULT 2;
