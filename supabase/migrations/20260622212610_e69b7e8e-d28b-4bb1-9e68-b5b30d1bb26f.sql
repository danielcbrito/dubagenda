
ALTER TABLE public.woovi_charges ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;

-- Função: chama a edge function release-barber-payment via pg_net
CREATE OR REPLACE FUNCTION public.trigger_release_barber_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_url TEXT := 'https://djtpzvujzmrrslirzwun.supabase.co';
  v_service_key TEXT;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    -- Chama a função apenas se houver charge PIX paga
    IF EXISTS (
      SELECT 1 FROM public.woovi_charges
      WHERE agendamento_id = NEW.id
        AND status = 'PAID'
        AND released_at IS NULL
    ) THEN
      PERFORM net.http_post(
        url := v_project_url || '/functions/v1/release-barber-payment',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object('agendamento_id', NEW.id)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_release_barber_payment ON public.agendamentos;
CREATE TRIGGER trg_release_barber_payment
AFTER UPDATE OF status ON public.agendamentos
FOR EACH ROW
EXECUTE FUNCTION public.trigger_release_barber_payment();
