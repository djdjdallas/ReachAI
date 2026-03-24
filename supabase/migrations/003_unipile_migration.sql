-- Migration: Add Unipile integration columns
-- Replaces Meta Graph API direct integration with Unipile unified messaging API

-- Add unipile_account_id to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS unipile_account_id TEXT;

-- Add unipile_chat_id to conversations table
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS unipile_chat_id TEXT;

-- Index for webhook lookups by unipile_account_id
CREATE INDEX IF NOT EXISTS idx_users_unipile_account_id
  ON public.users(unipile_account_id);

-- Index for conversation lookups by unipile_chat_id
CREATE INDEX IF NOT EXISTS idx_conversations_unipile_chat_id
  ON public.conversations(unipile_chat_id);
