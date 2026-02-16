
-- Add wallet PIN hash to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS wallet_pin_hash text;
