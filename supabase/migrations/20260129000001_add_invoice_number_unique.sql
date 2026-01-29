-- Enforce unique invoice numbers per company
ALTER TABLE invoices
  ADD CONSTRAINT invoices_company_invoice_number_unique
  UNIQUE (company_id, invoice_number);
