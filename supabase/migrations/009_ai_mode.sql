-- Replace the boolean ai_active with a three-state ai_mode column.
-- Values: 'active' (AI replies), 'handoff' (log only, no AI), 'off' (complete silence).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS ai_mode TEXT NOT NULL DEFAULT 'active';

-- Migrate existing data: ai_active=true -> 'active', ai_active=false -> 'handoff'
UPDATE public.users SET ai_mode = CASE
  WHEN ai_active = true THEN 'active'
  ELSE 'handoff'
END;

-- Add CHECK constraint
ALTER TABLE public.users
  ADD CONSTRAINT users_ai_mode_check
  CHECK (ai_mode IN ('active', 'handoff', 'off'));

COMMENT ON COLUMN public.users.ai_mode IS
  'active = AI replies to DMs, handoff = messages logged but no AI reply, off = complete silence';

-- Keep ai_active for now. Drop in a follow-up migration after code deploys.
