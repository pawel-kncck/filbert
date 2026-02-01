ALTER TABLE company_ksef_credentials
  ADD COLUMN refresh_token TEXT,
  ADD COLUMN refresh_token_expires_at TIMESTAMPTZ;
