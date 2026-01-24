-- Filbert Row Level Security Policies
-- Run this in the Supabase SQL Editor AFTER running schema.sql

-- Enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Companies: users can see companies they belong to + demo company
CREATE POLICY "Users can view own companies and demo" ON companies
  FOR SELECT USING (
    is_demo = true
    OR id IN (SELECT company_id FROM user_companies WHERE user_id = auth.uid() AND status = 'active')
  );

-- Companies: any authenticated user can create
CREATE POLICY "Users can create companies" ON companies
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND is_demo = false);

-- User-companies: users can view their own memberships
CREATE POLICY "Users can view own memberships" ON user_companies
  FOR SELECT USING (user_id = auth.uid());

-- User-companies: admins can view all memberships for their companies
CREATE POLICY "Admins can view company memberships" ON user_companies
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  );

-- User-companies: authenticated users can create (for joining companies)
CREATE POLICY "Users can request to join companies" ON user_companies
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- User-companies: admins can update status (approve/deny)
CREATE POLICY "Admins can update memberships" ON user_companies
  FOR UPDATE USING (
    company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  );

-- Invoices: users can view invoices for their active companies + demo
CREATE POLICY "Users can view invoices" ON invoices
  FOR SELECT USING (
    company_id = '00000000-0000-0000-0000-000000000000'
    OR company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Invoices: admins/members can insert for their companies
CREATE POLICY "Users can create invoices" ON invoices
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_companies
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'member')
      AND status = 'active'
    )
  );
