-- ============================================
-- MIGRAÇÃO: Agendas Individuais por Barbeiro
-- ============================================

-- 1. Atribuir todos os agendamentos existentes (com barbeiro_id NULL) ao Túlio
UPDATE public.agendamentos 
SET barbeiro_id = '767c51a7-7323-4933-8fc5-9a666f6baa7c'
WHERE barbeiro_id IS NULL;

-- 2. Atribuir todos os pending_bookings existentes (com barbeiro_id NULL) ao Túlio
UPDATE public.pending_bookings 
SET barbeiro_id = '767c51a7-7323-4933-8fc5-9a666f6baa7c'
WHERE barbeiro_id IS NULL;