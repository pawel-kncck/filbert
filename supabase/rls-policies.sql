-- Filbert Row Level Security Policies
-- Run this in the Supabase SQL Editor AFTER running schema.sql

-- ============================================
-- Helper function to check admin status
-- Uses SECURITY DEFINER to bypass RLS and avoid recursion
-- ============================================
CREATE OR REPLACE FUNCTION is_company_admin(check_company_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_companies
    WHERE user_id = auth.uid()
      AND company_id = check_company_id
      AND role = 'admin'
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Enable RLS on all tables
-- ============================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- ============================================
-- COMPANIES policies
-- ============================================

-- Users can see companies they belong to + demo company
CREATE POLICY "Users can view own companies and demo" ON companies
  FOR SELECT USING (
    is_demo = true
    OR id IN (SELECT company_id FROM user_companies WHERE user_id = auth.uid() AND status = 'active')
  );

-- Any authenticated user can create a company (except demo)
CREATE POLICY "Users can create companies" ON companies
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND is_demo = false);

-- ============================================
-- USER_COMPANIES policies
-- ============================================

-- Users can view their own memberships
CREATE POLICY "Users can view own memberships" ON user_companies
  FOR SELECT USING (user_id = auth.uid());

-- Admins can view all memberships for companies they admin
-- Uses helper function to avoid recursion
CREATE POLICY "Admins can view company memberships" ON user_companies
  FOR SELECT USING (is_company_admin(company_id));

-- Authenticated users can insert their own membership
CREATE POLICY "Users can request to join companies" ON user_companies
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Admins can update memberships for their companies
-- Uses helper function to avoid recursion
CREATE POLICY "Admins can update memberships" ON user_companies
  FOR UPDATE USING (is_company_admin(company_id));

-- ============================================
-- INVOICES policies
-- ============================================

-- Users can view invoices for their active companies + all demo companies
CREATE POLICY "Users can view invoices" ON invoices
  FOR SELECT USING (
    company_id IN (SELECT id FROM companies WHERE is_demo = true)
    OR company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Admins/members can insert invoices for their companies
CREATE POLICY "Users can create invoices" ON invoices
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'member')
        AND status = 'active'
    )
  );
