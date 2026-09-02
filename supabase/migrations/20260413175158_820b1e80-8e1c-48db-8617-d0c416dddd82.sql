
-- 1) Fix imediato: sincronizar todos os barbeiros para quarta-feira com horário global (14:30-20:00)
UPDATE public.configuracoes_horario_barbeiro
SET hora_abertura = '14:30',
    hora_fechamento = '20:00',
    hora_almoco_inicio = '13:30',
    hora_almoco_fim = '14:30',
    updated_at = now()
WHERE dia_semana = 3;

-- 2) Criar trigger que propaga alterações da config global para barbeiros
-- Quando a config global muda, atualiza barbeiros que tinham horários fora dos novos limites
CREATE OR REPLACE FUNCTION public.sync_barber_hours_on_global_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Se horário de abertura global ficou mais tarde, atualizar barbeiros que abrem antes
  IF NEW.hora_abertura IS NOT NULL THEN
    UPDATE public.configuracoes_horario_barbeiro
    SET hora_abertura = LEFT(NEW.hora_abertura::text, 5),
        updated_at = now()
    WHERE dia_semana = NEW.dia_semana
      AND hora_abertura IS NOT NULL
      AND hora_abertura::time < NEW.hora_abertura::time;
  END IF;

  -- Se horário de fechamento global ficou mais cedo, atualizar barbeiros que fecham depois
  IF NEW.hora_fechamento IS NOT NULL THEN
    UPDATE public.configuracoes_horario_barbeiro
    SET hora_fechamento = LEFT(NEW.hora_fechamento::text, 5),
        updated_at = now()
    WHERE dia_semana = NEW.dia_semana
      AND hora_fechamento IS NOT NULL
      AND hora_fechamento::time > NEW.hora_fechamento::time;
  END IF;

  -- Se dia global mudou para fechado, fechar todos os barbeiros
  IF NEW.aberto = false AND (OLD.aberto IS DISTINCT FROM NEW.aberto) THEN
    UPDATE public.configuracoes_horario_barbeiro
    SET aberto = false,
        updated_at = now()
    WHERE dia_semana = NEW.dia_semana;
  END IF;

  RETURN NEW;
END;
$$;

-- Criar o trigger na tabela de configurações globais
DROP TRIGGER IF EXISTS trg_sync_barber_hours_on_global_update ON public.configuracoes_horario;
CREATE TRIGGER trg_sync_barber_hours_on_global_update
  AFTER UPDATE ON public.configuracoes_horario
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_barber_hours_on_global_update();
