-- Migration 005: Security & Integrity Fixes
-- Run this manually in the Supabase SQL editor before deploying code changes.

-- ── Section A: Missing DELETE RLS policies (Issue #5) ──────────────────

CREATE POLICY "Users can delete own conversations"
  ON public.conversations FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete messages from own conversations"
  ON public.messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own bookings"
  ON public.bookings FOR DELETE
  USING (auth.uid() = user_id);

-- ── Section B: Idempotency column for message deduplication (Issue #8) ─

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT;

-- Partial unique index: only enforced when provider_message_id is not null.
-- Existing rows and messages without a provider ID won't conflict.
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_provider_message_id
  ON public.messages(provider_message_id)
  WHERE provider_message_id IS NOT NULL;

-- ── Section C: Atomic DM counter RPC function (Issue #4) ───────────────

CREATE OR REPLACE FUNCTION public.increment_dm_count(uid UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.users
  SET dm_count_this_month = COALESCE(dm_count_this_month, 0) + 1
  WHERE id = uid
  RETURNING dm_count_this_month;
$$;

-- ── Section D: Ensure trial_ends_at column exists (Issue #1) ───────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT NULL;
