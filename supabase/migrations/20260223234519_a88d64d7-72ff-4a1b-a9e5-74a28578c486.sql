
-- Add 'refund' to wallet_transactions type check constraint
ALTER TABLE public.wallet_transactions 
DROP CONSTRAINT wallet_transactions_type_check;

ALTER TABLE public.wallet_transactions 
ADD CONSTRAINT wallet_transactions_type_check 
CHECK (type = ANY (ARRAY['recharge'::text, 'withdraw'::text, 'transfer'::text, 'convert_credits'::text, 'payment'::text, 'refund'::text]));

-- Credit Daniel Brito's R$30 refund from cancelled card payment
UPDATE public.wallet_balances 
SET balance = balance + 30.00 
WHERE user_id = 'df8bc0ce-6963-4d3e-9ed6-7ff32d09c0c1';

-- Record transaction
INSERT INTO public.wallet_transactions (user_id, type, amount, status, description)
VALUES (
  'df8bc0ce-6963-4d3e-9ed6-7ff32d09c0c1',
  'refund',
  30.00,
  'completed',
  'Estorno de cancelamento (Cartão) - R$ 30.00'
);

-- Mark old cancellation credits as used (they shouldn't show as "available for conversion")
UPDATE public.creditos 
SET usado = true 
WHERE origem IN ('cancelamento', 'estorno_cancelamento') 
  AND usado = false;
