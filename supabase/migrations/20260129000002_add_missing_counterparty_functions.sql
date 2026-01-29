-- SQL functions to find invoice counterparties not yet in the vendors/customers tables.
-- Replaces two-query + JS deduplication with a single query using NOT EXISTS.

CREATE OR REPLACE FUNCTION get_missing_vendors_count(p_company_id uuid)
RETURNS bigint
LANGUAGE sql STABLE
AS $$
  SELECT count(*) FROM (
    SELECT DISTINCT i.vendor_name, i.vendor_nip
    FROM invoices i
    WHERE i.company_id = p_company_id
      AND i.type = 'purchase'
      AND NOT EXISTS (
        SELECT 1 FROM vendors v
        WHERE v.company_id = p_company_id
          AND v.name = i.vendor_name
          AND v.nip IS NOT DISTINCT FROM i.vendor_nip
      )
  ) sub
$$;

CREATE OR REPLACE FUNCTION get_missing_vendors(p_company_id uuid)
RETURNS TABLE(name text, nip text)
LANGUAGE sql STABLE
AS $$
  SELECT DISTINCT i.vendor_name AS name, i.vendor_nip AS nip
  FROM invoices i
  WHERE i.company_id = p_company_id
    AND i.type = 'purchase'
    AND NOT EXISTS (
      SELECT 1 FROM vendors v
      WHERE v.company_id = p_company_id
        AND v.name = i.vendor_name
        AND v.nip IS NOT DISTINCT FROM i.vendor_nip
    )
  ORDER BY name
$$;

CREATE OR REPLACE FUNCTION get_missing_customers_count(p_company_id uuid)
RETURNS bigint
LANGUAGE sql STABLE
AS $$
  SELECT count(*) FROM (
    SELECT DISTINCT i.customer_name, i.customer_nip
    FROM invoices i
    WHERE i.company_id = p_company_id
      AND i.type = 'sales'
      AND NOT EXISTS (
        SELECT 1 FROM customers c
        WHERE c.company_id = p_company_id
          AND c.name = i.customer_name
          AND c.nip IS NOT DISTINCT FROM i.customer_nip
      )
  ) sub
$$;

CREATE OR REPLACE FUNCTION get_missing_customers(p_company_id uuid)
RETURNS TABLE(name text, nip text)
LANGUAGE sql STABLE
AS $$
  SELECT DISTINCT i.customer_name AS name, i.customer_nip AS nip
  FROM invoices i
  WHERE i.company_id = p_company_id
    AND i.type = 'sales'
    AND NOT EXISTS (
      SELECT 1 FROM customers c
      WHERE c.company_id = p_company_id
        AND c.name = i.customer_name
        AND c.nip IS NOT DISTINCT FROM i.customer_nip
    )
  ORDER BY name
$$;
