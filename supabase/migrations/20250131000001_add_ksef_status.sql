-- Add KSeF submission status tracking to invoices
ALTER TABLE invoices ADD COLUMN ksef_status TEXT CHECK (ksef_status IN ('pending', 'sent', 'accepted', 'rejected', 'error'));
ALTER TABLE invoices ADD COLUMN ksef_error TEXT;
ALTER TABLE invoices ADD COLUMN ksef_sent_at TIMESTAMPTZ;
