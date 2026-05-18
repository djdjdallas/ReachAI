-- Migration: Native Send outbound context bridge
--
-- Lets a user pre-log a cold DM they sent manually from native Instagram so
-- that when the inbound reply hits the webhook, Clinchd can match it, inject
-- the original outbound into the AI's context window, and qualify the lead
-- the same as if Clinchd had sent the cold outreach itself.
--
-- Changes:
--   1. native_send_outbound table + RLS + indexes
--   2. conversations.origin                  ('clinchd_sent' | 'native_send')
--   3. conversations.missing_outbound_context boolean — set when an inbound
--      reply arrives with no matching native_send_outbound record, surfaced
--      in the dashboard as a "Backfill original DM" banner
--   4. messages.source extended to allow 'native_send'
--   5. match_and_claim_native_send RPC — atomic claim with
--      FOR UPDATE SKIP LOCKED so two simultaneous replies can't both
--      match the same logged outbound

-- ── native_send_outbound ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.native_send_outbound (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_ig_user_id TEXT,
  recipient_handle TEXT,
  dm_text TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  matched_conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (recipient_ig_user_id IS NOT NULL OR recipient_handle IS NOT NULL),
  CHECK (length(dm_text) > 0)
);

CREATE INDEX IF NOT EXISTS idx_native_send_outbound_user_ig_id
  ON public.native_send_outbound(user_id, recipient_ig_user_id);

CREATE INDEX IF NOT EXISTS idx_native_send_outbound_user_handle_matched
  ON public.native_send_outbound(user_id, lower(recipient_handle), matched_conversation_id);

-- Hot-path partial index: the webhook lookup always filters on
-- matched_conversation_id IS NULL and orders by sent_at DESC.
CREATE INDEX IF NOT EXISTS idx_native_send_outbound_unmatched_lookup
  ON public.native_send_outbound(user_id, sent_at DESC)
  WHERE matched_conversation_id IS NULL;

ALTER TABLE public.native_send_outbound ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own native sends"
  ON public.native_send_outbound FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own native sends"
  ON public.native_send_outbound FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own native sends"
  ON public.native_send_outbound FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own native sends"
  ON public.native_send_outbound FOR DELETE
  USING (auth.uid() = user_id);

-- ── conversations.origin ────────────────────────────────────────────────
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'clinchd_sent'
  CHECK (origin IN ('clinchd_sent', 'native_send'));

-- ── conversations.missing_outbound_context ──────────────────────────────
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS missing_outbound_context BOOLEAN NOT NULL DEFAULT false;

-- ── messages.source extension ───────────────────────────────────────────
-- Migration 019 added the original CHECK constraint with ('lead','agent','manual').
-- We add 'native_send' for messages injected from a logged native-send record.
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_source_check;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_source_check
  CHECK (source IN ('lead', 'agent', 'manual', 'native_send'));

-- ── match_and_claim_native_send RPC ─────────────────────────────────────
-- Atomically finds the most-recent unmatched native_send_outbound row for
-- this user + recipient and claims it by setting matched_conversation_id.
--
-- Prefers an ig_user_id match over a handle-only match. Uses FOR UPDATE
-- SKIP LOCKED inside the CTE so that two simultaneous replies for the same
-- lead can't both claim the same logged outbound: the first transaction
-- locks the row and updates it, the second skips the locked row and
-- returns zero rows.
--
-- Returns the claimed row (id, dm_text, sent_at) so the caller can inject
-- the original outbound as the first assistant message in history.
-- Returns zero rows when there is no match (caller flags the conversation
-- with missing_outbound_context = true).
--
-- SECURITY INVOKER + explicit user_id filter: the webhook calls with a
-- service-role client (no JWT), so RLS bypasses; if ever called from a
-- user context, RLS on native_send_outbound still scopes by auth.uid().

CREATE OR REPLACE FUNCTION public.match_and_claim_native_send(
  p_user_id UUID,
  p_conversation_id UUID,
  p_recipient_ig_user_id TEXT,
  p_recipient_handle TEXT
)
RETURNS TABLE (
  id UUID,
  dm_text TEXT,
  sent_at TIMESTAMPTZ
)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_claimed_id UUID;
BEGIN
  IF p_user_id IS NULL OR p_conversation_id IS NULL THEN
    RETURN;
  END IF;

  IF p_recipient_ig_user_id IS NULL AND p_recipient_handle IS NULL THEN
    RETURN;
  END IF;

  -- Lock + claim in one statement. The SELECT inside the CTE acquires a
  -- row-level lock with SKIP LOCKED; the UPDATE then sets the match.
  WITH candidate AS (
    SELECT nso.id
    FROM public.native_send_outbound nso
    WHERE nso.user_id = p_user_id
      AND nso.matched_conversation_id IS NULL
      AND (
        (p_recipient_ig_user_id IS NOT NULL
          AND nso.recipient_ig_user_id = p_recipient_ig_user_id)
        OR
        (p_recipient_handle IS NOT NULL
          AND nso.recipient_handle IS NOT NULL
          AND lower(nso.recipient_handle) = lower(p_recipient_handle))
      )
    ORDER BY
      -- Prefer ig_user_id match over handle-only match
      CASE
        WHEN p_recipient_ig_user_id IS NOT NULL
          AND nso.recipient_ig_user_id = p_recipient_ig_user_id THEN 0
        ELSE 1
      END,
      nso.sent_at DESC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.native_send_outbound nso
  SET matched_conversation_id = p_conversation_id
  FROM candidate
  WHERE nso.id = candidate.id
  RETURNING nso.id INTO v_claimed_id;

  IF v_claimed_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT nso.id, nso.dm_text, nso.sent_at
    FROM public.native_send_outbound nso
    WHERE nso.id = v_claimed_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_and_claim_native_send(UUID, UUID, TEXT, TEXT)
  TO authenticated, service_role;

-- ── Realtime ────────────────────────────────────────────────────────────
-- Dashboard subscribes to native_send_outbound so the "recent logs" table
-- updates live when a webhook claims a row.
ALTER PUBLICATION supabase_realtime ADD TABLE public.native_send_outbound;
