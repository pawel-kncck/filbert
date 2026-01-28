-- Migration: Add additional demo companies
-- This migration adds two new demo companies and fixes demo invoice data

-- ============================================
-- Step 1: Add new demo companies (if they don't exist)
-- ============================================

-- Demo buyer company
INSERT INTO companies (id, name, nip, is_demo)
VALUES ('00000000-0000-0000-0000-000000000001', 'Demo Klient Sp. z o.o.', '0000000001', true)
ON CONFLICT (id) DO NOTHING;

-- Demo vendor company
INSERT INTO companies (id, name, nip, is_demo)
VALUES ('00000000-0000-0000-0000-000000000002', 'Demo Dostawca S.A.', '0000000002', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Step 2: Update RLS policy for invoices to include all demo companies
-- ============================================

-- Drop existing policy
DROP POLICY IF EXISTS "Users can view invoices" ON invoices;

-- Create updated policy that checks is_demo flag
CREATE POLICY "Users can view invoices" ON invoices
  FOR SELECT USING (
    company_id IN (SELECT id FROM companies WHERE is_demo = true)
    OR company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ============================================
-- Step 3: Fix existing Demo Sp. z o.o. invoices
-- Ensure vendor/customer are correct based on invoice type
-- ============================================

-- For Sales invoices: Demo Sp. z o.o. must be the vendor (seller)
UPDATE invoices
SET
  vendor_name = 'Demo Sp. z o.o.',
  vendor_nip = '0000000000'
WHERE company_id = '00000000-0000-0000-0000-000000000000'
  AND type = 'sales'
  AND source = 'demo';

-- For Sales invoices: Customer cannot be Demo Sp. z o.o.
UPDATE invoices
SET
  customer_name = 'Demo Klient Sp. z o.o.',
  customer_nip = '0000000001'
WHERE company_id = '00000000-0000-0000-0000-000000000000'
  AND type = 'sales'
  AND source = 'demo'
  AND customer_name = 'Demo Sp. z o.o.';

-- For Purchase invoices: Demo Sp. z o.o. must be the customer (buyer)
UPDATE invoices
SET
  customer_name = 'Demo Sp. z o.o.',
  customer_nip = '0000000000'
WHERE company_id = '00000000-0000-0000-0000-000000000000'
  AND type = 'purchase'
  AND source = 'demo';

-- For Purchase invoices: Vendor cannot be Demo Sp. z o.o.
UPDATE invoices
SET
  vendor_name = 'Demo Dostawca S.A.',
  vendor_nip = '0000000002'
WHERE company_id = '00000000-0000-0000-0000-000000000000'
  AND type = 'purchase'
  AND source = 'demo'
  AND vendor_name = 'Demo Sp. z o.o.';
