
-- Add PIX payment fields to assinaturas for pending PIX payments
ALTER TABLE public.assinaturas
  ADD COLUMN IF NOT EXISTS asaas_payment_id text,
  ADD COLUMN IF NOT EXISTS pix_qr_code text,
  ADD COLUMN IF NOT EXISTS pix_payload text,
  ADD COLUMN IF NOT EXISTS pix_expires_at timestamptz;
