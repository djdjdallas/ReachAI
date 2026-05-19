-- One-time fix: overwrite dominickjerell's HIGH_INTENT dm_templates row with
-- a clean default for the Meta App Review screencast recording.
--
-- Why this is a script and NOT a migration: it touches a single user's data,
-- not schema. Migrations must be idempotent across all envs (dev/staging/prod)
-- and re-runnable; this script targets one production row by email and is
-- safe to delete after running.
--
-- Run via the Supabase SQL editor (web UI) — do not commit any execution
-- output. After confirming the row updated, delete this file.
--
-- Verify after running:
--   SELECT intent_class, template, updated_at
--   FROM dm_templates
--   WHERE creator_id = (SELECT id FROM users WHERE email = 'dominickjerell@gmail.com')
--   ORDER BY intent_class;

UPDATE dm_templates
SET
  template = 'hey {{COMMENTER_NAME}} — appreciate the comment! grab a quick call and i''ll walk you through {{OFFER_NAME}}: {{BOOKING_LINK}}',
  updated_at = NOW()
WHERE creator_id = (SELECT id FROM users WHERE email = 'dominickjerell@gmail.com')
  AND intent_class = 'HIGH_INTENT';

-- If no row exists yet (e.g. founder never saved this class), insert one.
INSERT INTO dm_templates (creator_id, intent_class, template)
SELECT
  (SELECT id FROM users WHERE email = 'dominickjerell@gmail.com'),
  'HIGH_INTENT',
  'hey {{COMMENTER_NAME}} — appreciate the comment! grab a quick call and i''ll walk you through {{OFFER_NAME}}: {{BOOKING_LINK}}'
WHERE NOT EXISTS (
  SELECT 1 FROM dm_templates
  WHERE creator_id = (SELECT id FROM users WHERE email = 'dominickjerell@gmail.com')
    AND intent_class = 'HIGH_INTENT'
);
