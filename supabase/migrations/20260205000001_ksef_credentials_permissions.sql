-- Add permission tracking, default credential flag, and certificate expiry
ALTER TABLE company_ksef_credentials
  ADD COLUMN granted_permissions JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN certificate_expires_at TIMESTAMPTZ;

-- Only one default credential per company
CREATE UNIQUE INDEX idx_one_default_per_company
  ON company_ksef_credentials (company_id)
  WHERE is_default = true;
