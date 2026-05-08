-- 020_conversation_force_agent.sql
--
-- Adds:
--   conversations.force_agent — per-conversation override for the
--                               "outreach-initiated" gate in the IG
--                               webhook. When true, the agent will
--                               reply on inbound messages even if the
--                               founder didn't start the thread via
--                               the New Outreach composer (e.g. story
--                               replies, IG-app DMs, late opt-in).
--
-- Default false preserves current behavior — only conversations that
-- have been explicitly handed off via the dashboard toggle bypass the
-- earliest-message=='manual' check.

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS force_agent BOOLEAN NOT NULL DEFAULT false;
