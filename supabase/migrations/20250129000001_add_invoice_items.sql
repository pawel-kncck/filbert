-- Migration: Add invoice_items table
-- Stores line items for invoices

-- ============================================
-- Step 1: Create invoice_items table
-- ============================================
CREATE TABLE invoice_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  position INT NOT NULL,
  description TEXT NOT NULL,
  quantity DECIMAL(10,3) NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'szt.',
  unit_price DECIMAL(12,2) NOT NULL,
  vat_rate DECIMAL(5,2) NOT NULL DEFAULT 23,
  net_amount DECIMAL(12,2) NOT NULL,
  vat_amount DECIMAL(12,2) NOT NULL,
  gross_amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- Step 2: Create indexes
-- ============================================
CREATE INDEX invoice_items_invoice_id_idx ON invoice_items (invoice_id);

-- ============================================
-- Step 3: Row Level Security
-- ============================================
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- SELECT: users who can view the parent invoice (active company members + demo companies)
CREATE POLICY "Users can view invoice items" ON invoice_items
  FOR SELECT USING (
    invoice_id IN (
      SELECT id FROM invoices WHERE
        company_id IN (SELECT id FROM companies WHERE is_demo = true)
        OR company_id IN (
          SELECT company_id FROM user_companies
          WHERE user_id = auth.uid() AND status = 'active'
        )
    )
  );

-- INSERT: admin or member of the parent invoice's company
CREATE POLICY "Members can create invoice items" ON invoice_items
  FOR INSERT WITH CHECK (
    invoice_id IN (
      SELECT id FROM invoices WHERE is_company_member(company_id)
    )
  );

-- UPDATE: admin or member of the parent invoice's company
CREATE POLICY "Members can update invoice items" ON invoice_items
  FOR UPDATE USING (
    invoice_id IN (
      SELECT id FROM invoices WHERE is_company_member(company_id)
    )
  );

-- DELETE: admin or member of the parent invoice's company
CREATE POLICY "Members can delete invoice items" ON invoice_items
  FOR DELETE USING (
    invoice_id IN (
      SELECT id FROM invoices WHERE is_company_member(company_id)
    )
  );
