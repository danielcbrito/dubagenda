-- ============================================
-- FIX: Replica Identity FULL para tabelas do canal-fidelidade
-- Sem isso, filtros Realtime (user_id=eq.X) não funcionam
-- em eventos UPDATE (payload não inclui colunas não-PK)
-- ============================================

ALTER TABLE public.assinaturas REPLICA IDENTITY FULL;
ALTER TABLE public.pontos REPLICA IDENTITY FULL;
ALTER TABLE public.resgates REPLICA IDENTITY FULL;
ALTER TABLE public.plano_agendamentos_usos REPLICA IDENTITY FULL;
ALTER TABLE public.promocoes REPLICA IDENTITY FULL;