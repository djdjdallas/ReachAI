ALTER TABLE users
  ADD COLUMN meta_page_id TEXT DEFAULT NULL,
  ADD COLUMN meta_page_access_token TEXT DEFAULT NULL,
  ADD COLUMN instagram_business_account_id TEXT DEFAULT NULL,
  ADD COLUMN meta_user_access_token TEXT DEFAULT NULL,
  ADD COLUMN meta_token_expires_at TIMESTAMPTZ DEFAULT NULL;
