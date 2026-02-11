
-- Tabela de saldo da carteira
CREATE TABLE public.wallet_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallet balance"
  ON public.wallet_balances FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert wallet balance"
  ON public.wallet_balances FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can update wallet balance"
  ON public.wallet_balances FOR UPDATE
  USING (auth.uid() = user_id);

-- Tabela de transações da carteira
CREATE TABLE public.wallet_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('recharge', 'withdraw', 'transfer', 'convert_credits', 'payment')),
  amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  description TEXT,
  metadata JSONB DEFAULT '{}',
  gateway_payment_id TEXT,
  pix_qr_code TEXT,
  pix_payload TEXT,
  pix_expires_at TIMESTAMPTZ,
  destination_bank_code TEXT,
  destination_agency TEXT,
  destination_account TEXT,
  destination_name TEXT,
  destination_cpf TEXT,
  destination_pix_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallet transactions"
  ON public.wallet_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wallet transactions"
  ON public.wallet_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own wallet transactions"
  ON public.wallet_transactions FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_wallet_balances_updated_at
  BEFORE UPDATE ON public.wallet_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_wallet_transactions_updated_at
  BEFORE UPDATE ON public.wallet_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Função para obter ou criar saldo da carteira
CREATE OR REPLACE FUNCTION public.get_or_create_wallet_balance(p_user_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_balance NUMERIC;
BEGIN
  SELECT balance INTO v_balance FROM public.wallet_balances WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    INSERT INTO public.wallet_balances (user_id, balance) VALUES (p_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;
    v_balance := 0;
  END IF;
  RETURN v_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
