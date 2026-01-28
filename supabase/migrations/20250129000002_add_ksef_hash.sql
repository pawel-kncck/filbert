-- Migration: Add ksef_hash column to invoices
-- Stores SHA-256 Base64URL hash from KSeF, used for QR code generation (KOD I)

ALTER TABLE invoices ADD COLUMN ksef_hash TEXT;
