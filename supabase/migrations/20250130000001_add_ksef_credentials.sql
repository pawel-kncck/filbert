-- Migration: Add KSeF credentials table and company update/delete policies
-- Stores KSeF API credentials per company (admin-only access)

-- ============================================
-- Step 1: Create company_ksef_credentials table
-- ============================================
CREATE TABLE company_ksef_credentials (
  company_id UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'test' CHECK (environment IN ('test', 'demo', 'prod')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- Step 2: Create updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_company_ksef_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER company_ksef_credentials_updated_at
  BEFORE UPDATE ON company_ksef_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_company_ksef_credentials_updated_at();

-- ============================================
-- Step 3: Row Level Security for credentials
-- ============================================
ALTER TABLE company_ksef_credentials ENABLE ROW LEVEL SECURITY;

-- Only admins can view credentials
CREATE POLICY "Admins can view credentials" ON company_ksef_credentials
  FOR SELECT USING (is_company_admin(company_id));

-- Only admins can insert credentials
CREATE POLICY "Admins can insert credentials" ON company_ksef_credentials
  FOR INSERT WITH CHECK (is_company_admin(company_id));

-- Only admins can update credentials
CREATE POLICY "Admins can update credentials" ON company_ksef_credentials
  FOR UPDATE USING (is_company_admin(company_id));

-- Only admins can delete credentials
CREATE POLICY "Admins can delete credentials" ON company_ksef_credentials
  FOR DELETE USING (is_company_admin(company_id));

-- ============================================
-- Step 4: Add update/delete policies for companies table
-- ============================================

-- Admins can update their company (e.g., name)
CREATE POLICY "Admins can update company" ON companies
  FOR UPDATE USING (is_company_admin(id));

-- Admins can delete their company
CREATE POLICY "Admins can delete company" ON companies
  FOR DELETE USING (is_company_admin(id));
