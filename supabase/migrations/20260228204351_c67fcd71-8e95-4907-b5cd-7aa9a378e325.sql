
-- 1) Add cash_payment_confirmed flag to assinaturas
ALTER TABLE public.assinaturas
ADD COLUMN IF NOT EXISTS cash_payment_confirmed boolean DEFAULT true;

-- Set existing cash active subscriptions as confirmed (backward compat)
UPDATE public.assinaturas
SET cash_payment_confirmed = true
WHERE payment_method = 'cash' AND status = 'active';

-- New cash subscriptions will be created with cash_payment_confirmed = false

-- 2) Update the consume_plan_use trigger to enforce limit=1 when cash not confirmed
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
  v_cash_confirmed boolean;
BEGIN
  -- Apenas para agendamentos via plano
  IF COALESCE(NEW.payment_method, '') <> 'plano' AND COALESCE(NEW.tipo_agendamento, '') <> 'plano' THEN
    RETURN NEW;
  END IF;

  v_competencia := date_trunc('month', NEW.data)::date;

  -- Assinatura ativa do usuário
  SELECT a.id, COALESCE(p.limite_agendamentos_mes, 4), COALESCE(a.cash_payment_confirmed, true)
    INTO v_assinatura_id, v_limite, v_cash_confirmed
  FROM public.assinaturas a
  JOIN public.planos p ON p.id = a.plano_id
  WHERE a.user_id = NEW.user_id
    AND a.status = 'active'
  ORDER BY a.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_assinatura_id IS NULL THEN
    RAISE EXCEPTION 'NO_ACTIVE_SUBSCRIPTION';
  END IF;

  -- Se pagamento em dinheiro ainda não confirmado, limite = 1
  IF NOT v_cash_confirmed THEN
    v_limite := 1;
  END IF;

  -- Regra do produto: limite GLOBAL (não por competência)
  SELECT COUNT(*)
    INTO v_usados
  FROM public.plano_agendamentos_usos u
  WHERE u.user_id = NEW.user_id
    AND u.released_at IS NULL;

  IF v_usados >= v_limite THEN
    RAISE EXCEPTION 'PLAN_LIMIT_REACHED';
  END IF;

  -- Registra o consumo
  INSERT INTO public.plano_agendamentos_usos (user_id, assinatura_id, agendamento_id, competencia)
  VALUES (NEW.user_id, v_assinatura_id, NEW.id, v_competencia)
  ON CONFLICT (agendamento_id) DO NOTHING;

  -- Consistência do agendamento
  UPDATE public.agendamentos
  SET payment_method = 'plano',
      tipo_agendamento = 'plano',
      is_free = true,
      preco = 0,
      updated_at = now()
  WHERE id = NEW.id;

  RETURN NEW;
END;
$function$;
