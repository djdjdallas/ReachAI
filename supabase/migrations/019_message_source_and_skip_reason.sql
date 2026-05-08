-- 019_message_source_and_skip_reason.sql
--
-- Adds:
--   1. messages.source         — distinguishes lead / agent / manual replies
--   2. conversations.last_skip_reason
--                              — surfaces why the agent skipped a turn so the
--                                dashboard can explain silent-no-reply gates
--   3. users.has_seen_onboarding_modal
--                              — first-login modal flag (separate from the
--                                existing signup-flow `onboarding_completed`)

-- ── messages.source ─────────────────────────────────────────────────────
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'agent'
  CHECK (source IN ('lead', 'agent', 'manual'));

-- Backfill: existing inbound messages → 'lead'.
-- Existing assistant rows stay as 'agent' (the default). Pre-migration manual
-- replies will be mislabeled as 'agent'; going forward they will be correct.
UPDATE public.messages
SET source = 'lead'
WHERE role = 'user' AND source = 'agent';

-- ── conversations.last_skip_reason ──────────────────────────────────────
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS last_skip_reason TEXT DEFAULT NULL;
-- Values: 'no_greeting' | 'subscription_inactive' | 'dm_limit'
--        | 'trial_expired' | 'not_outreach_initiated' | NULL
-- 'not_outreach_initiated' is set by the webhook gate when the earliest
-- message in the conversation is not source='manual' — i.e. the founder
-- did not start the thread via the in-app outreach composer.

-- ── users.has_seen_onboarding_modal ─────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS has_seen_onboarding_modal BOOLEAN NOT NULL DEFAULT false;
