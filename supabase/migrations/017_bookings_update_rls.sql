-- Migration 017: Add missing UPDATE RLS policy on bookings.
-- Run this manually in the Supabase SQL editor.
--
-- Migrations 001 and 005 set up SELECT / INSERT / DELETE for bookings
-- but missed UPDATE. Dashboard-driven booking edits silently no-op
-- because of RLS. Admin-client paths (e.g. Calendly webhook) were
-- unaffected because service_role bypasses RLS.

CREATE POLICY "Users can update own bookings"
  ON public.bookings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
