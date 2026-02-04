-- Migration: Transform KSeF credentials to support multiple credentials per company
-- Adds a proper UUID primary key, validation tracking, and unique constraint per environment+method

-- ============================================
-- Step 1: Drop existing primary key and add UUID id column
-- ============================================
-- First drop the check constraint that references the columns
ALTER TABLE company_ksef_credentials
  DROP CONSTRAINT IF EXISTS credentials_auth_method_check;

-- Add new id column
ALTER TABLE company_ksef_credentials
  ADD COLUMN id UUID DEFAULT gen_random_uuid();

-- Backfill existing rows with UUIDs
UPDATE company_ksef_credentials SET id = gen_random_uuid() WHERE id IS NULL;

-- Make id NOT NULL
ALTER TABLE company_ksef_credentials
  ALTER COLUMN id SET NOT NULL;

-- Drop the old primary key (company_id)
ALTER TABLE company_ksef_credentials
  DROP CONSTRAINT company_ksef_credentials_pkey;

-- Add id as the new primary key
ALTER TABLE company_ksef_credentials
  ADD PRIMARY KEY (id);

-- Keep the foreign key on company_id
-- (Already exists from CASCADE relationship)

-- ============================================
-- Step 2: Add unique constraint per company + environment + auth_method
-- ============================================
ALTER TABLE company_ksef_credentials
  ADD CONSTRAINT unique_credential_per_env_method
  UNIQUE (company_id, environment, auth_method);

-- ============================================
-- Step 3: Add validation tracking columns
-- ============================================
ALTER TABLE company_ksef_credentials
  ADD COLUMN validated_at TIMESTAMPTZ,
  ADD COLUMN validation_status TEXT DEFAULT 'pending'
    CHECK (validation_status IN ('valid', 'invalid', 'pending')),
  ADD COLUMN validation_error TEXT;

-- ============================================
-- Step 4: Add optional name column for user-friendly credential naming
-- ============================================
ALTER TABLE company_ksef_credentials
  ADD COLUMN name TEXT;

-- ============================================
-- Step 5: Re-add the auth method check constraint
-- ============================================
ALTER TABLE company_ksef_credentials
  ADD CONSTRAINT credentials_auth_method_check CHECK (
    (auth_method = 'token' AND token IS NOT NULL) OR
    (auth_method = 'certificate' AND certificate_pem IS NOT NULL AND encrypted_private_key IS NOT NULL)
  );

-- ============================================
-- Step 6: Create index for faster lookups by company_id
-- ============================================
CREATE INDEX IF NOT EXISTS idx_company_ksef_credentials_company_id
  ON company_ksef_credentials(company_id);
