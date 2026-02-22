
-- Fix: Corrigir delay_entre_servicos global de 0 para 10 minutos
UPDATE public.configuracoes_horario
SET delay_entre_servicos = 10
WHERE delay_entre_servicos = 0 OR delay_entre_servicos IS NULL;
