-- Migration: Add customers table
-- Stores customer information for companies

-- ============================================
-- Step 1: Create customers table
-- ============================================
CREATE TABLE customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  nip TEXT,
  address TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  is_synced BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- Step 2: Create indexes
-- ============================================

-- Partial unique index: one customer per NIP per company (NIP is optional)
CREATE UNIQUE INDEX customers_company_nip_unique
  ON customers (company_id, nip) WHERE nip IS NOT NULL;

-- Lookup by company
CREATE INDEX customers_company_id_idx ON customers (company_id);

-- Search by name
CREATE INDEX customers_name_idx ON customers (name);

-- ============================================
-- Step 3: Create updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_customers_updated_at();

-- ============================================
-- Step 4: Row Level Security
-- ============================================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- SELECT: active users of the company + demo companies
CREATE POLICY "Users can view customers" ON customers
  FOR SELECT USING (
    company_id IN (SELECT id FROM companies WHERE is_demo = true)
    OR company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- INSERT: admin or member
CREATE POLICY "Members can create customers" ON customers
  FOR INSERT WITH CHECK (is_company_member(company_id));

-- UPDATE: admin or member
CREATE POLICY "Members can update customers" ON customers
  FOR UPDATE USING (is_company_member(company_id));

-- DELETE: admin only
CREATE POLICY "Admins can delete customers" ON customers
  FOR DELETE USING (is_company_admin(company_id));
