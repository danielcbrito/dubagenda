CREATE OR REPLACE FUNCTION public.add_wallet_credits(
  p_user_id UUID,
  p_amount NUMERIC,
  p_description TEXT DEFAULT 'Reembolso'
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_new_balance NUMERIC;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  INSERT INTO wallet_balances (user_id, balance)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = wallet_balances.balance + p_amount,
        updated_at = NOW()
  RETURNING balance INTO v_new_balance;

  INSERT INTO wallet_transactions (
    user_id, type, amount, status, description
  ) VALUES (
    p_user_id, 'refund', p_amount, 'completed', p_description
  );

  RETURN v_new_balance;
END;
$$;