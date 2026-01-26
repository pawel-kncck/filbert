-- Filbert Database Schema
-- Run this in the Supabase SQL Editor

-- Companies table with demo flag
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  nip VARCHAR(10) NOT NULL UNIQUE,
  is_demo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User-Company relationship with pending status
CREATE TABLE user_companies (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('admin', 'member', 'viewer')) DEFAULT 'member',
  status TEXT CHECK (status IN ('active', 'pending')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, company_id)
);

-- Invoices table
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  type TEXT CHECK (type IN ('sales', 'purchase')) NOT NULL,
  invoice_number TEXT NOT NULL,
  issue_date DATE NOT NULL,
  vendor_name TEXT NOT NULL,
  vendor_nip VARCHAR(10),
  customer_name TEXT NOT NULL,
  customer_nip VARCHAR(10),
  net_amount DECIMAL(12,2) NOT NULL,
  vat_amount DECIMAL(12,2) NOT NULL,
  gross_amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'PLN',
  ksef_reference TEXT,
  source TEXT CHECK (source IN ('manual', 'demo', 'ksef')) DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_invoices_company_type ON invoices(company_id, type);
CREATE INDEX idx_invoices_issue_date ON invoices(issue_date);
CREATE INDEX idx_invoices_vendor_name ON invoices(vendor_name);
CREATE INDEX idx_invoices_customer_name ON invoices(customer_name);
CREATE INDEX idx_user_companies_user ON user_companies(user_id);

-- Demo companies (well-known UUIDs)
-- Main demo company
INSERT INTO companies (id, name, nip, is_demo)
VALUES ('00000000-0000-0000-0000-000000000000', 'Demo Sp. z o.o.', '0000000000', true);

-- Demo buyer company (appears as customer on Demo Sp. z o.o. Sales invoices)
INSERT INTO companies (id, name, nip, is_demo)
VALUES ('00000000-0000-0000-0000-000000000001', 'Demo Klient Sp. z o.o.', '0000000001', true);

-- Demo vendor company (appears as vendor on Demo Sp. z o.o. Purchase invoices)
INSERT INTO companies (id, name, nip, is_demo)
VALUES ('00000000-0000-0000-0000-000000000002', 'Demo Dostawca S.A.', '0000000002', true);
