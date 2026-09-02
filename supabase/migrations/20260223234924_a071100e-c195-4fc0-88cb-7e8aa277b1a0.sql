
-- Adicionar R$ 30 ao saldo do Diego Santos Lima
UPDATE public.wallet_balances 
SET balance = balance + 30.00 
WHERE user_id = '940b88e3-ee38-4c6c-9872-6a37a023096d';

-- Registrar transação no histórico
INSERT INTO public.wallet_transactions (user_id, type, amount, status, description)
VALUES (
  '940b88e3-ee38-4c6c-9872-6a37a023096d',
  'refund',
  30.00,
  'completed',
  'Crédito manual - Estorno de pagamento - R$ 30.00'
);
