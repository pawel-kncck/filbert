-- Migration: Fix RLS infinite recursion
-- Run this in Supabase SQL Editor to fix the user_companies policies

-- ============================================
-- Step 1: Drop existing policies that cause recursion
-- ============================================
DROP POLICY IF EXISTS "Admins can view company memberships" ON user_companies;
DROP POLICY IF EXISTS "Admins can update memberships" ON user_companies;

-- ============================================
-- Step 2: Create helper function with SECURITY DEFINER
-- This bypasses RLS when checking admin status, avoiding recursion
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
-- Step 3: Recreate policies using the helper function
-- ============================================

-- Admins can view all memberships for companies they admin
CREATE POLICY "Admins can view company memberships" ON user_companies
  FOR SELECT USING (is_company_admin(company_id));

-- Admins can update memberships for their companies
CREATE POLICY "Admins can update memberships" ON user_companies
  FOR UPDATE USING (is_company_admin(company_id));
