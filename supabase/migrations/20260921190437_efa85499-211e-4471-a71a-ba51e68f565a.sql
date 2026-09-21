CREATE OR REPLACE FUNCTION public.consume_plan_use_on_appointment_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  DECLARE
    v_assinatura_id uuid;
    v_limite integer;
    v_usados integer;
    v_competencia date;
    v_sub_status text;
    v_next_billing date;
    v_cycle_start date;
    v_cycle_end date;
    v_cash_pending boolean;
    v_privileged boolean;
  BEGIN
    IF NEW.tipo_agendamento = 'plano_registro_interno' THEN
      RETURN NEW;
    END IF;

    IF COALESCE(NEW.payment_method, '') <> 'plano' AND COALESCE(NEW.tipo_agendamento, '') NOT IN ('plano', 'assinatura_silenciosa') THEN
      RETURN NEW;
    END IF;

    v_competencia := date_trunc('month', NEW.data)::date;

    SELECT a.id, COALESCE(p.limite_agendamentos_mes, 4), a.status::text, a.next_billing_date,
           (a.payment_method::text = 'cash' AND COALESCE(a.cash_payment_confirmed, false) = false)
      INTO v_assinatura_id, v_limite, v_sub_status, v_next_billing, v_cash_pending
    FROM public.assinaturas a
    JOIN public.planos p ON p.id = a.plano_id
    WHERE a.user_id = NEW.user_id
      AND a.status IN ('active', 'pending_cash')
    ORDER BY a.created_at DESC NULLS LAST
    LIMIT 1;

    v_privileged := (auth.role() = 'service_role')
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'ti'::app_role);

    IF v_assinatura_id IS NULL THEN
      -- Sem assinatura ativa: não permite agendamento cobrado como plano
      IF v_privileged OR NEW.tipo_agendamento = 'assinatura_silenciosa' THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'PLANO_INEXISTENTE'
        USING detail = 'Nenhuma assinatura ativa encontrada para este cliente.',
              hint = 'Assine um plano para agendar com plano.';
    END IF;

    -- Pagamento em dinheiro ainda não confirmado pelo barbeiro: apenas 1 uso liberado
    IF v_sub_status = 'pending_cash' OR v_cash_pending THEN
      v_limite := 1;
    END IF;

    IF v_next_billing IS NOT NULL THEN
      v_cycle_start := (v_next_billing - INTERVAL '1 month')::date;
      v_cycle_end := v_next_billing;
    ELSE
      v_cycle_start := '-infinity'::date;
      v_cycle_end := 'infinity'::date;
    END IF;

    IF EXISTS (SELECT 1 FROM public.plano_agendamentos_usos WHERE agendamento_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    v_usados := public.count_subscription_uses_in_cycle(
      v_assinatura_id,
      v_cycle_start,
      v_cycle_end
    );

    IF v_usados >= v_limite THEN
      IF v_privileged THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'PLANO_SEM_CREDITOS'
        USING detail = format('Limite de %s agendamento(s) do plano já utilizado neste ciclo.', v_limite),
              hint = 'Aguarde a renovação do plano ou a confirmação do pagamento em dinheiro pelo barbeiro.';
    END IF;

    INSERT INTO public.plano_agendamentos_usos (user_id, assinatura_id, agendamento_id, competencia)
    VALUES (NEW.user_id, v_assinatura_id, NEW.id, v_competencia)
    ON CONFLICT (agendamento_id) DO NOTHING;

    RETURN NEW;
  END;
  $function$;