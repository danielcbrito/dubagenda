
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
  v_cycle_start timestamptz;
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

  -- Calcular início do ciclo atual (next_billing_date - 1 mês)
  IF v_next_billing IS NOT NULL THEN
    v_cycle_start := (v_next_billing - interval '1 month')::timestamptz;
  ELSE
    v_cycle_start := '-infinity'::timestamptz;
  END IF;

  -- Contagem de usos APENAS para o CICLO ATUAL da assinatura
  SELECT COUNT(*)
    INTO v_usados
  FROM public.plano_agendamentos_usos u
  WHERE u.assinatura_id = v_assinatura_id
    AND u.released_at IS NULL
    AND u.created_at >= v_cycle_start;

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

-- Corrigir também a função de visualização do barbeiro
CREATE OR REPLACE FUNCTION public.get_plan_usage_for_barber_view(p_user_id uuid, p_barbeiro_id uuid)
RETURNS TABLE(assinatura_id uuid, plan_limit integer, used_count integer, has_plan boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_allowed boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  v_allowed := (
    auth.uid() = p_user_id
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'tenant_admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.barbeiros b
      WHERE b.id = p_barbeiro_id
        AND b.user_id = auth.uid()
    )
  );

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  RETURN QUERY
  WITH latest_sub AS (
    SELECT s.id, s.plano_id, s.next_billing_date
    FROM public.assinaturas s
    WHERE s.user_id = p_user_id
      AND s.barbeiro_id = p_barbeiro_id
      AND s.status IN ('active', 'pending_cash')
    ORDER BY s.created_at DESC
    LIMIT 1
  )
  SELECT
    ls.id AS assinatura_id,
    COALESCE(p.limite_agendamentos_mes, 4)::integer AS plan_limit,
    COALESCE((
      SELECT COUNT(*)::integer
      FROM public.plano_agendamentos_usos u
      WHERE u.assinatura_id = ls.id
        AND u.released_at IS NULL
        AND u.created_at >= (ls.next_billing_date - interval '1 month')
    ), 0) AS used_count,
    true AS has_plan
  FROM latest_sub ls
  LEFT JOIN public.planos p ON p.id = ls.plano_id

  UNION ALL

  SELECT
    NULL::uuid AS assinatura_id,
    4::integer AS plan_limit,
    0::integer AS used_count,
    false AS has_plan
  WHERE NOT EXISTS (SELECT 1 FROM latest_sub);
END;
$function$;
