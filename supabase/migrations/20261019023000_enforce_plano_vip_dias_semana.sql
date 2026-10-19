-- Migration: Restringir agendamento com plano na Barbearia VIP Exclusive exclusivamente para Terça, Quarta e Quinta
-- Tenant: '5e825363-70ff-4abe-9143-9e87758437e7' (Barbearia VIP Exclusive)
-- Dias da semana no PostgreSQL (DOW): 0 = Domingo, 1 = Segunda, 2 = Terça, 3 = Quarta, 4 = Quinta, 5 = Sexta, 6 = Sábado

CREATE OR REPLACE FUNCTION public.enforce_plano_allowed_weekdays()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_dow int;
BEGIN
  -- Verifica se é agendamento de plano
  IF NEW.tipo_agendamento = 'plano' OR COALESCE(NEW.payment_method, '') = 'plano' THEN
    -- Obter tenant do barbeiro
    SELECT tenant_id INTO v_tenant_id FROM public.barbeiros WHERE id = NEW.barbeiro_id;
    
    -- Fallback: perfil do usuário
    IF v_tenant_id IS NULL THEN
      SELECT barbearia_preferida_id INTO v_tenant_id FROM public.profiles WHERE id = NEW.user_id;
    END IF;

    -- Se for Barbearia VIP Exclusive ('5e825363-70ff-4abe-9143-9e87758437e7')
    IF v_tenant_id = '5e825363-70ff-4abe-9143-9e87758437e7'::uuid THEN
      v_dow := EXTRACT(DOW FROM NEW.data)::int;
      -- Apenas 2 (Terça), 3 (Quarta) e 4 (Quinta) são permitidos
      IF v_dow NOT IN (2, 3, 4) THEN
        RAISE EXCEPTION 'Agendamentos com plano na Barbearia VIP são permitidos exclusivamente às terças, quartas e quintas-feiras.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_plano_allowed_weekdays ON public.agendamentos;
CREATE TRIGGER trg_enforce_plano_allowed_weekdays
BEFORE INSERT OR UPDATE OF data, tipo_agendamento, payment_method ON public.agendamentos
FOR EACH ROW
EXECUTE FUNCTION public.enforce_plano_allowed_weekdays();
