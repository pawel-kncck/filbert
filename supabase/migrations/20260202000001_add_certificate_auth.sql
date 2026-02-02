-- Migration: Add certificate-based authentication support for KSeF
-- Allows companies to authenticate using qualified electronic certificates
-- instead of (or in addition to) KSeF tokens.

-- ============================================
-- Step 1: Add auth_method column
-- ============================================
ALTER TABLE company_ksef_credentials
  ADD COLUMN auth_method TEXT NOT NULL DEFAULT 'token'
    CHECK (auth_method IN ('token', 'certificate'));

-- ============================================
-- Step 2: Add certificate storage columns
-- ============================================
-- PEM-encoded X.509 certificate (public)
ALTER TABLE company_ksef_credentials
  ADD COLUMN certificate_pem TEXT;

-- Private key encrypted with AES-256-GCM using server-side key.
-- Format: {iv_base64}:{auth_tag_base64}:{ciphertext_base64}
ALTER TABLE company_ksef_credentials
  ADD COLUMN encrypted_private_key TEXT;

-- ============================================
-- Step 3: Make token nullable for certificate auth
-- ============================================
ALTER TABLE company_ksef_credentials
  ALTER COLUMN token DROP NOT NULL;

-- ============================================
-- Step 4: Add check constraint for auth method requirements
-- ============================================
-- Token auth requires token; certificate auth requires certificate + key
ALTER TABLE company_ksef_credentials
  ADD CONSTRAINT credentials_auth_method_check CHECK (
    (auth_method = 'token' AND token IS NOT NULL) OR
    (auth_method = 'certificate' AND certificate_pem IS NOT NULL AND encrypted_private_key IS NOT NULL)
  );
