-- 1. Atualizar o trigger para liberar cota do plano quando status = 'no_show'
CREATE OR REPLACE FUNCTION public.release_plan_use_on_appointment_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Libera cota quando status muda para cancelado OU no_show
  IF NEW.status IN ('cancelled_by_user', 'cancelled_by_admin', 'no_show')
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND (COALESCE(OLD.payment_method, '') = 'plano' OR COALESCE(OLD.tipo_agendamento, '') = 'plano')
  THEN
    UPDATE public.plano_agendamentos_usos
    SET released_at = now()
    WHERE agendamento_id = NEW.id
      AND released_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Liberar a cota do agendamento no_show do cliente Luis Guilherme
UPDATE public.plano_agendamentos_usos
SET released_at = now()
WHERE agendamento_id = 'bf09caad-5bea-467b-8597-b76a714a6d8c'
  AND released_at IS NULL;