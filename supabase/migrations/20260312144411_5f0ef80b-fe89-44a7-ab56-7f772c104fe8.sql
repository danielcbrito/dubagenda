-- ============================================
-- FIX: Replica Identity FULL para todas as tabelas
-- com Realtime ativo + filtros não-PK
-- Sem isso, filtros como user_id=eq.X são ignorados
-- ============================================

ALTER TABLE public.notificacoes REPLICA IDENTITY FULL;
ALTER TABLE public.barbeiros REPLICA IDENTITY FULL;
ALTER TABLE public.servicos REPLICA IDENTITY FULL;
ALTER TABLE public.configuracoes_horario_barbeiro REPLICA IDENTITY FULL;
ALTER TABLE public.horarios_excepcionais REPLICA IDENTITY FULL;
ALTER TABLE public.horarios_excepcionais_barbeiro REPLICA IDENTITY FULL;
ALTER TABLE public.barbeiro_avaliacoes REPLICA IDENTITY FULL;
ALTER TABLE public.depositos REPLICA IDENTITY FULL;
ALTER TABLE public.wallet_balances REPLICA IDENTITY FULL;
ALTER TABLE public.barbeiro_unidades REPLICA IDENTITY FULL;
ALTER TABLE public.tenant_unidades REPLICA IDENTITY FULL;
ALTER TABLE public.support_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.support_messages REPLICA IDENTITY FULL;