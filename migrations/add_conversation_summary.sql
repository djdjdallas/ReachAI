ALTER TABLE conversations
  ADD COLUMN ai_summary TEXT DEFAULT NULL,
  ADD COLUMN lead_temperature TEXT DEFAULT NULL;
