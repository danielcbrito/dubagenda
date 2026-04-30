ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS cupom_id uuid REFERENCES public.cupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS desconto_aplicado numeric(10,2),
  ADD COLUMN IF NOT EXISTS preco_final numeric(10,2);

CREATE INDEX IF NOT EXISTS idx_agendamentos_cupom_id ON public.agendamentos(cupom_id);