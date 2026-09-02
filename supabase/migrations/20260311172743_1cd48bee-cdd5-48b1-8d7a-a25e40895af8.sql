
-- Fix: count by usage record creation date within the cycle, not appointment date.
-- An appointment booked and consumed in a previous cycle should NOT count against the new cycle,
-- even if the appointment date falls within the new cycle.

CREATE OR REPLACE FUNCTION public.count_subscription_uses_in_cycle(
  p_assinatura_id uuid,
  p_cycle_start date,
  p_cycle_end date
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COUNT(*)::integer
  FROM public.plano_agendamentos_usos u
  JOIN public.agendamentos a ON a.id = u.agendamento_id
  WHERE u.assinatura_id = p_assinatura_id
    AND u.released_at IS NULL
    AND u.created_at >= (p_cycle_start::timestamp AT TIME ZONE 'America/Sao_Paulo')
    AND u.created_at < (p_cycle_end::timestamp AT TIME ZONE 'America/Sao_Paulo')
    AND COALESCE(a.status::text, '') NOT IN ('cancelled_by_user', 'cancelled_by_admin', 'excluido');
$function$;

-- Also fix the trigger to use the same logic
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
BEGIN
  -- Apenas para agendamentos via plano
  IF COALESCE(NEW.payment_method, '') <> 'plano' AND COALESCE(NEW.tipo_agendamento, '') <> 'plano' THEN
    RETURN NEW;
  END IF;

  v_competencia := date_trunc('month', NEW.data)::date;

  -- Assinatura ativa OU pending_cash do usuário (mais recente)
  SELECT a.id, COALESCE(p.limite_agendamentos_mes, 4), a.status::text, a.next_billing_date
    INTO v_assinatura_id, v_limite, v_sub_status, v_next_billing
  FROM public.assinaturas a
  JOIN public.planos p ON p.id = a.plano_id
  WHERE a.user_id = NEW.user_id
    AND a.status IN ('active', 'pending_cash')
  ORDER BY a.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_assinatura_id IS NULL THEN
    RAISE EXCEPTION 'NO_ACTIVE_SUBSCRIPTION';
  END IF;

  -- Para pending_cash, limite é 1 (apenas o primeiro corte)
  IF v_sub_status = 'pending_cash' THEN
    v_limite := 1;
  END IF;

  -- Janela do ciclo atual inferida da cobrança da assinatura
  IF v_next_billing IS NOT NULL THEN
    v_cycle_start := (v_next_billing - INTERVAL '1 month')::date;
    v_cycle_end := v_next_billing;
  ELSE
    v_cycle_start := '-infinity'::date;
    v_cycle_end := 'infinity'::date;
  END IF;

  -- Contagem: considerar quando o uso foi CONSUMIDO (created_at) dentro do ciclo
  v_usados := public.count_subscription_uses_in_cycle(
    v_assinatura_id,
    v_cycle_start,
    v_cycle_end
  );

  IF v_usados >= v_limite THEN
    RAISE EXCEPTION 'PLAN_LIMIT_REACHED';
  END IF;

  -- Registra o consumo vinculado à assinatura atual
  INSERT INTO public.plano_agendamentos_usos (user_id, assinatura_id, agendamento_id, competencia)
  VALUES (NEW.user_id, v_assinatura_id, NEW.id, v_competencia)
  ON CONFLICT (agendamento_id) DO NOTHING;

  -- Consistência do agendamento
  UPDATE public.agendamentos
  SET payment_method = 'plano',
      tipo_agendamento = 'plano',
      is_free = CASE WHEN v_sub_status = 'pending_cash' THEN false ELSE true END,
      preco = CASE WHEN v_sub_status = 'pending_cash' THEN NEW.preco ELSE 0 END,
      updated_at = now()
  WHERE id = NEW.id;

  RETURN NEW;
END;
$function$;
