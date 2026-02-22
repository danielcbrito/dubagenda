
-- Fix: Atualizar domingo para ABERTO na Barbearia dos Santos 
-- (barbeiro_id: afb89c07-cad2-4d87-be85-a9793eda91dd)
UPDATE public.configuracoes_horario_barbeiro 
SET aberto = true, updated_at = now()
WHERE barbeiro_id = 'afb89c07-cad2-4d87-be85-a9793eda91dd' 
  AND dia_semana = 0;
