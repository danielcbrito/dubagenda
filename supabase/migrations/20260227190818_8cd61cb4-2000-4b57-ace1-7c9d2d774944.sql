-- Debitar R$ 30,00 da carteira do Diego (diego.alchemist@hotmail.com)
UPDATE wallet_balances 
SET balance = balance - 30, updated_at = now() 
WHERE user_id = '940b88e3-ee38-4c6c-9872-6a37a023096d';

-- Registrar a transação de débito
INSERT INTO wallet_transactions (user_id, type, amount, status, description)
VALUES (
  '940b88e3-ee38-4c6c-9872-6a37a023096d',
  'withdraw',
  30,
  'completed',
  'Débito administrativo de R$ 30,00'
);