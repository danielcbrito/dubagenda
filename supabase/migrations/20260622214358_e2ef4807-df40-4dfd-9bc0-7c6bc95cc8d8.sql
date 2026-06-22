-- Reverter escrow: cobrança PIX agora vai direto pra subconta do barbeiro.
-- Não há mais "release" a fazer — o dinheiro já cai na conta do barbeiro no momento do pagamento.
DROP TRIGGER IF EXISTS trg_release_barber_payment ON public.agendamentos;
DROP FUNCTION IF EXISTS public.trigger_release_barber_payment();