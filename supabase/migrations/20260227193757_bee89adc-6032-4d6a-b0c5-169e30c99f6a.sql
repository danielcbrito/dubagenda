-- Add 'pending_cash' to subscription_status enum
ALTER TYPE public.subscription_status ADD VALUE IF NOT EXISTS 'pending_cash';
