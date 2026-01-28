-- Migration: Add vendors table
-- Stores vendor (supplier) information for companies

-- ============================================
-- Step 1: Create vendors table
-- ============================================
CREATE TABLE vendors (
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

-- Partial unique index: one vendor per NIP per company (NIP is optional)
CREATE UNIQUE INDEX vendors_company_nip_unique
  ON vendors (company_id, nip) WHERE nip IS NOT NULL;

-- Lookup by company
CREATE INDEX vendors_company_id_idx ON vendors (company_id);

-- Search by name
CREATE INDEX vendors_name_idx ON vendors (name);

-- ============================================
-- Step 3: Create updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_vendors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vendors_updated_at
  BEFORE UPDATE ON vendors
  FOR EACH ROW
  EXECUTE FUNCTION update_vendors_updated_at();

-- ============================================
-- Step 4: Create helper function for member check
-- ============================================
CREATE OR REPLACE FUNCTION is_company_member(check_company_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_companies
    WHERE user_id = auth.uid()
      AND company_id = check_company_id
      AND role IN ('admin', 'member')
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Step 5: Row Level Security
-- ============================================
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

-- SELECT: active users of the company + demo companies
CREATE POLICY "Users can view vendors" ON vendors
  FOR SELECT USING (
    company_id IN (SELECT id FROM companies WHERE is_demo = true)
    OR company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- INSERT: admin or member
CREATE POLICY "Members can create vendors" ON vendors
  FOR INSERT WITH CHECK (is_company_member(company_id));

-- UPDATE: admin or member
CREATE POLICY "Members can update vendors" ON vendors
  FOR UPDATE USING (is_company_member(company_id));

-- DELETE: admin only
CREATE POLICY "Admins can delete vendors" ON vendors
  FOR DELETE USING (is_company_admin(company_id));
