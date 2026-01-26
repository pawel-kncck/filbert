-- Seed Demo Invoices for Demo Companies
-- Run this in the Supabase SQL Editor AFTER running schema.sql and rls-policies.sql

-- Demo company UUIDs:
-- Demo Sp. z o.o.: 00000000-0000-0000-0000-000000000000
-- Demo Klient Sp. z o.o.: 00000000-0000-0000-0000-000000000001
-- Demo Dostawca S.A.: 00000000-0000-0000-0000-000000000002

-- Clear existing demo invoices
DELETE FROM invoices WHERE source = 'demo';

-- ============================================
-- INVOICES FOR DEMO SP. Z O.O.
-- Sales: Demo Sp. z o.o. is always the VENDOR (seller)
-- Purchase: Demo Sp. z o.o. is always the CUSTOMER (buyer)
-- ============================================

-- Sales invoices for Demo Sp. z o.o. (they are the seller)
INSERT INTO invoices (
  company_id, type, invoice_number, issue_date,
  vendor_name, vendor_nip, customer_name, customer_nip,
  net_amount, vat_amount, gross_amount, currency, source
)
SELECT
  '00000000-0000-0000-0000-000000000000' AS company_id,
  'sales' AS type,
  'FV/' || TO_CHAR(issue_date, 'YYYY') || '/' || LPAD(row_num::text, 4, '0') AS invoice_number,
  issue_date,
  'Demo Sp. z o.o.' AS vendor_name,
  '0000000000' AS vendor_nip,
  customer_name,
  customer_nip,
  net_amount,
  ROUND(net_amount * 0.23, 2) AS vat_amount,
  ROUND(net_amount * 1.23, 2) AS gross_amount,
  'PLN' AS currency,
  'demo' AS source
FROM (
  SELECT
    row_number() OVER () AS row_num,
    (CURRENT_DATE - (random() * 365)::int) AS issue_date,
    ROUND((random() * 50000 + 100)::numeric, 2) AS net_amount,
    (ARRAY[
      'Demo Klient Sp. z o.o.',
      'Demo Klient Sp. z o.o.',
      'ABC Handel Sp. z o.o.',
      'Kowalski i Synowie S.A.',
      'TechPol Sp. z o.o.',
      'IT Solutions Sp. z o.o.',
      'Budmax S.A.',
      'MediCare Sp. z o.o.'
    ])[1 + floor(random() * 8)::int] AS customer_name,
    (ARRAY[
      '0000000001',
      '0000000001',
      '1234567890',
      '2345678901',
      '3456789012',
      '6789012345',
      '7890123456',
      '9012345678'
    ])[1 + floor(random() * 8)::int] AS customer_nip
  FROM generate_series(1, 25)
) AS sales_data;

-- Purchase invoices for Demo Sp. z o.o. (they are the buyer)
INSERT INTO invoices (
  company_id, type, invoice_number, issue_date,
  vendor_name, vendor_nip, customer_name, customer_nip,
  net_amount, vat_amount, gross_amount, currency, source
)
SELECT
  '00000000-0000-0000-0000-000000000000' AS company_id,
  'purchase' AS type,
  'FZ/' || TO_CHAR(issue_date, 'YYYY') || '/' || LPAD(row_num::text, 4, '0') AS invoice_number,
  issue_date,
  vendor_name,
  vendor_nip,
  'Demo Sp. z o.o.' AS customer_name,
  '0000000000' AS customer_nip,
  net_amount,
  ROUND(net_amount * 0.23, 2) AS vat_amount,
  ROUND(net_amount * 1.23, 2) AS gross_amount,
  'PLN' AS currency,
  'demo' AS source
FROM (
  SELECT
    row_number() OVER () AS row_num,
    (CURRENT_DATE - (random() * 365)::int) AS issue_date,
    ROUND((random() * 50000 + 100)::numeric, 2) AS net_amount,
    (ARRAY[
      'Demo Dostawca S.A.',
      'Demo Dostawca S.A.',
      'Polska Dystrybucja S.A.',
      'Nowak Transport Sp. z o.o.',
      'Agro-Pol Sp. z o.o.',
      'EuroTrade Sp. z o.o.',
      'Gastro Plus Sp. z o.o.',
      'Elektro-Mont S.A.'
    ])[1 + floor(random() * 8)::int] AS vendor_name,
    (ARRAY[
      '0000000002',
      '0000000002',
      '4567890123',
      '5678901234',
      '8901234567',
      '0123456789',
      '1111111111',
      '4444444444'
    ])[1 + floor(random() * 8)::int] AS vendor_nip
  FROM generate_series(1, 25)
) AS purchase_data;

-- ============================================
-- INVOICES FOR DEMO KLIENT SP. Z O.O.
-- This company buys from Demo Sp. z o.o. and sells to others
-- ============================================

-- Sales invoices for Demo Klient (they sell to other companies)
INSERT INTO invoices (
  company_id, type, invoice_number, issue_date,
  vendor_name, vendor_nip, customer_name, customer_nip,
  net_amount, vat_amount, gross_amount, currency, source
)
SELECT
  '00000000-0000-0000-0000-000000000001' AS company_id,
  'sales' AS type,
  'FV/' || TO_CHAR(issue_date, 'YYYY') || '/' || LPAD(row_num::text, 4, '0') AS invoice_number,
  issue_date,
  'Demo Klient Sp. z o.o.' AS vendor_name,
  '0000000001' AS vendor_nip,
  customer_name,
  customer_nip,
  net_amount,
  ROUND(net_amount * 0.23, 2) AS vat_amount,
  ROUND(net_amount * 1.23, 2) AS gross_amount,
  'PLN' AS currency,
  'demo' AS source
FROM (
  SELECT
    row_number() OVER () AS row_num,
    (CURRENT_DATE - (random() * 365)::int) AS issue_date,
    ROUND((random() * 30000 + 100)::numeric, 2) AS net_amount,
    (ARRAY[
      'ABC Handel Sp. z o.o.',
      'TechPol Sp. z o.o.',
      'Budmax S.A.',
      'Auto Serwis Kowalczyk'
    ])[1 + floor(random() * 4)::int] AS customer_name,
    (ARRAY[
      '1234567890',
      '3456789012',
      '7890123456',
      '2222222222'
    ])[1 + floor(random() * 4)::int] AS customer_nip
  FROM generate_series(1, 15)
) AS sales_data;

-- Purchase invoices for Demo Klient (they buy from Demo Sp. z o.o. and others)
INSERT INTO invoices (
  company_id, type, invoice_number, issue_date,
  vendor_name, vendor_nip, customer_name, customer_nip,
  net_amount, vat_amount, gross_amount, currency, source
)
SELECT
  '00000000-0000-0000-0000-000000000001' AS company_id,
  'purchase' AS type,
  'FZ/' || TO_CHAR(issue_date, 'YYYY') || '/' || LPAD(row_num::text, 4, '0') AS invoice_number,
  issue_date,
  vendor_name,
  vendor_nip,
  'Demo Klient Sp. z o.o.' AS customer_name,
  '0000000001' AS customer_nip,
  net_amount,
  ROUND(net_amount * 0.23, 2) AS vat_amount,
  ROUND(net_amount * 1.23, 2) AS gross_amount,
  'PLN' AS currency,
  'demo' AS source
FROM (
  SELECT
    row_number() OVER () AS row_num,
    (CURRENT_DATE - (random() * 365)::int) AS issue_date,
    ROUND((random() * 40000 + 100)::numeric, 2) AS net_amount,
    (ARRAY[
      'Demo Sp. z o.o.',
      'Demo Sp. z o.o.',
      'Demo Dostawca S.A.',
      'Polska Dystrybucja S.A.',
      'EuroTrade Sp. z o.o.'
    ])[1 + floor(random() * 5)::int] AS vendor_name,
    (ARRAY[
      '0000000000',
      '0000000000',
      '0000000002',
      '4567890123',
      '0123456789'
    ])[1 + floor(random() * 5)::int] AS vendor_nip
  FROM generate_series(1, 20)
) AS purchase_data;

-- ============================================
-- INVOICES FOR DEMO DOSTAWCA S.A.
-- This company sells to Demo Sp. z o.o. and others
-- ============================================

-- Sales invoices for Demo Dostawca (they sell to Demo Sp. z o.o. and others)
INSERT INTO invoices (
  company_id, type, invoice_number, issue_date,
  vendor_name, vendor_nip, customer_name, customer_nip,
  net_amount, vat_amount, gross_amount, currency, source
)
SELECT
  '00000000-0000-0000-0000-000000000002' AS company_id,
  'sales' AS type,
  'FV/' || TO_CHAR(issue_date, 'YYYY') || '/' || LPAD(row_num::text, 4, '0') AS invoice_number,
  issue_date,
  'Demo Dostawca S.A.' AS vendor_name,
  '0000000002' AS vendor_nip,
  customer_name,
  customer_nip,
  net_amount,
  ROUND(net_amount * 0.23, 2) AS vat_amount,
  ROUND(net_amount * 1.23, 2) AS gross_amount,
  'PLN' AS currency,
  'demo' AS source
FROM (
  SELECT
    row_number() OVER () AS row_num,
    (CURRENT_DATE - (random() * 365)::int) AS issue_date,
    ROUND((random() * 60000 + 500)::numeric, 2) AS net_amount,
    (ARRAY[
      'Demo Sp. z o.o.',
      'Demo Sp. z o.o.',
      'Demo Klient Sp. z o.o.',
      'Kowalski i Synowie S.A.',
      'MediCare Sp. z o.o.'
    ])[1 + floor(random() * 5)::int] AS customer_name,
    (ARRAY[
      '0000000000',
      '0000000000',
      '0000000001',
      '2345678901',
      '9012345678'
    ])[1 + floor(random() * 5)::int] AS customer_nip
  FROM generate_series(1, 20)
) AS sales_data;

-- Purchase invoices for Demo Dostawca (they buy from various suppliers)
INSERT INTO invoices (
  company_id, type, invoice_number, issue_date,
  vendor_name, vendor_nip, customer_name, customer_nip,
  net_amount, vat_amount, gross_amount, currency, source
)
SELECT
  '00000000-0000-0000-0000-000000000002' AS company_id,
  'purchase' AS type,
  'FZ/' || TO_CHAR(issue_date, 'YYYY') || '/' || LPAD(row_num::text, 4, '0') AS invoice_number,
  issue_date,
  vendor_name,
  vendor_nip,
  'Demo Dostawca S.A.' AS customer_name,
  '0000000002' AS customer_nip,
  net_amount,
  ROUND(net_amount * 0.23, 2) AS vat_amount,
  ROUND(net_amount * 1.23, 2) AS gross_amount,
  'PLN' AS currency,
  'demo' AS source
FROM (
  SELECT
    row_number() OVER () AS row_num,
    (CURRENT_DATE - (random() * 365)::int) AS issue_date,
    ROUND((random() * 80000 + 1000)::numeric, 2) AS net_amount,
    (ARRAY[
      'Fabryka Mebli Stolarz',
      'Agro-Pol Sp. z o.o.',
      'Elektro-Mont S.A.',
      'Biuro Rachunkowe Marta'
    ])[1 + floor(random() * 4)::int] AS vendor_name,
    (ARRAY[
      '5555555555',
      '8901234567',
      '4444444444',
      '3333333333'
    ])[1 + floor(random() * 4)::int] AS vendor_nip
  FROM generate_series(1, 15)
) AS purchase_data;
