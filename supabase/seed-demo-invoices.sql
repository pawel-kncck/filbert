-- Seed Demo Invoices for Demo Company
-- Run this in the Supabase SQL Editor AFTER running schema.sql and rls-policies.sql

-- Demo company UUID
-- id: 00000000-0000-0000-0000-000000000000

-- Polish company names for variety
WITH company_names AS (
  SELECT unnest(ARRAY[
    'ABC Handel Sp. z o.o.',
    'Kowalski i Synowie S.A.',
    'TechPol Sp. z o.o.',
    'Polska Dystrybucja S.A.',
    'Nowak Transport Sp. z o.o.',
    'IT Solutions Sp. z o.o.',
    'Budmax S.A.',
    'Agro-Pol Sp. z o.o.',
    'MediCare Sp. z o.o.',
    'EuroTrade Sp. z o.o.',
    'Gastro Plus Sp. z o.o.',
    'Auto Serwis Kowalczyk',
    'Biuro Rachunkowe Marta',
    'Elektro-Mont S.A.',
    'Fabryka Mebli Stolarz'
  ]) AS name,
  unnest(ARRAY[
    '1234567890',
    '2345678901',
    '3456789012',
    '4567890123',
    '5678901234',
    '6789012345',
    '7890123456',
    '8901234567',
    '9012345678',
    '0123456789',
    '1111111111',
    '2222222222',
    '3333333333',
    '4444444444',
    '5555555555'
  ]) AS nip
)
INSERT INTO invoices (
  company_id,
  type,
  invoice_number,
  issue_date,
  vendor_name,
  vendor_nip,
  customer_name,
  customer_nip,
  net_amount,
  vat_amount,
  gross_amount,
  currency,
  source
)
SELECT
  '00000000-0000-0000-0000-000000000000' AS company_id,
  CASE WHEN random() > 0.5 THEN 'sales' ELSE 'purchase' END AS type,
  'FV/' || TO_CHAR(issue_date, 'YYYY') || '/' || LPAD((row_number() OVER ())::text, 4, '0') AS invoice_number,
  issue_date,
  CASE
    WHEN random() > 0.5 THEN 'Demo Sp. z o.o.'
    ELSE (SELECT name FROM company_names ORDER BY random() LIMIT 1)
  END AS vendor_name,
  CASE
    WHEN random() > 0.5 THEN '0000000000'
    ELSE (SELECT nip FROM company_names ORDER BY random() LIMIT 1)
  END AS vendor_nip,
  CASE
    WHEN random() > 0.5 THEN (SELECT name FROM company_names ORDER BY random() LIMIT 1)
    ELSE 'Demo Sp. z o.o.'
  END AS customer_name,
  CASE
    WHEN random() > 0.5 THEN (SELECT nip FROM company_names ORDER BY random() LIMIT 1)
    ELSE '0000000000'
  END AS customer_nip,
  net_amount,
  ROUND(net_amount * 0.23, 2) AS vat_amount,
  ROUND(net_amount * 1.23, 2) AS gross_amount,
  'PLN' AS currency,
  'demo' AS source
FROM (
  SELECT
    (CURRENT_DATE - (random() * 365)::int) AS issue_date,
    ROUND((random() * 50000 + 100)::numeric, 2) AS net_amount
  FROM generate_series(1, 50)
) AS invoice_data;

-- Update invoices to ensure vendor/customer logic is correct based on type
UPDATE invoices
SET
  vendor_name = 'Demo Sp. z o.o.',
  vendor_nip = '0000000000'
WHERE company_id = '00000000-0000-0000-0000-000000000000'
  AND type = 'sales'
  AND vendor_name != 'Demo Sp. z o.o.';

UPDATE invoices
SET
  customer_name = 'Demo Sp. z o.o.',
  customer_nip = '0000000000'
WHERE company_id = '00000000-0000-0000-0000-000000000000'
  AND type = 'purchase'
  AND customer_name != 'Demo Sp. z o.o.';
