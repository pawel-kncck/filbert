-- Add column to store raw KSeF XML for debugging and reference
ALTER TABLE invoices ADD COLUMN ksef_xml TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN invoices.ksef_xml IS 'Raw XML content downloaded from KSeF for invoices with source=ksef';
