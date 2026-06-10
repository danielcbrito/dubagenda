-- 1. SECURITY TRIGGER: Prevent clients from manipulating sensitive fields
CREATE OR REPLACE FUNCTION public.guard_client_appointment_updates()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_is_privileged boolean;
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  
  SELECT (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'ti'::app_role) OR
    EXISTS(SELECT 1 FROM public.barbeiros WHERE id = NEW.barbeiro_id AND user_id = auth.uid()) OR
    EXISTS(SELECT 1 FROM public.tenants t JOIN public.barbeiros b ON b.tenant_id = t.id 
           WHERE b.id = NEW.barbeiro_id AND t.owner_user_id = auth.uid())
  ) INTO v_is_privileged;

  IF NOT v_is_privileged AND auth.uid() = NEW.user_id THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status NOT IN ('cancelled_by_user'::appointment_status) THEN
        RAISE EXCEPTION 'Clientes só podem cancelar agendamentos.';
      END IF;
    END IF;
    
    NEW.barbeiro_confirmou := OLD.barbeiro_confirmou;
    NEW.cliente_confirmou := OLD.cliente_confirmou;
    NEW.is_free := OLD.is_free;
    NEW.ponto_liberado := OLD.ponto_liberado;
    NEW.preco := OLD.preco;
    NEW.preco_final := OLD.preco_final;
    NEW.payment_method := OLD.payment_method;
    NEW.usado_redemption_id := OLD.usado_redemption_id;
    NEW.servico_id := OLD.servico_id;
    NEW.barbeiro_id := OLD.barbeiro_id;
    NEW.user_id := OLD.user_id;
    NEW.tipo_agendamento := OLD.tipo_agendamento;
    NEW.data := OLD.data;
    NEW.hora := OLD.hora;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_client_appointment_updates ON public.agendamentos;
CREATE TRIGGER trg_guard_client_appointment_updates
BEFORE UPDATE ON public.agendamentos
FOR EACH ROW
EXECUTE FUNCTION public.guard_client_appointment_updates();

-- 2. INSERT GUARD
CREATE OR REPLACE FUNCTION public.guard_client_appointment_inserts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_is_privileged boolean;
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  
  SELECT (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'ti'::app_role) OR
    EXISTS(SELECT 1 FROM public.barbeiros WHERE id = NEW.barbeiro_id AND user_id = auth.uid()) OR
    EXISTS(SELECT 1 FROM public.tenants t JOIN public.barbeiros b ON b.tenant_id = t.id 
           WHERE b.id = NEW.barbeiro_id AND t.owner_user_id = auth.uid())
  ) INTO v_is_privileged;

  IF NOT v_is_privileged AND auth.uid() = NEW.user_id THEN
    IF NEW.status NOT IN ('pending'::appointment_status, 'confirmed'::appointment_status) THEN
      RAISE EXCEPTION 'Cliente não pode criar agendamentos finalizados.';
    END IF;
    
    IF NEW.is_free = true AND COALESCE(NEW.payment_method, '') NOT IN ('resgate', 'plano') THEN
      NEW.is_free := false;
      NEW.preco := COALESCE((SELECT preco FROM public.servicos WHERE id = NEW.servico_id), NEW.preco);
    END IF;

    NEW.barbeiro_confirmou := false;
    NEW.ponto_liberado := false;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_client_appointment_inserts ON public.agendamentos;
CREATE TRIGGER trg_guard_client_appointment_inserts
BEFORE INSERT ON public.agendamentos
FOR EACH ROW
EXECUTE FUNCTION public.guard_client_appointment_inserts();

-- 3. HARDEN AWARD LOYALTY POINT (recurring + anti-fraud)
CREATE OR REPLACE FUNCTION public.award_loyalty_point()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_points integer;
  promo_id uuid;
  promo_pontos integer;
  v_tenant_id uuid;
  v_service_name text;
  v_has_active_redemption boolean;
  v_last_point_today boolean;
BEGIN
  IF (OLD.status IS DISTINCT FROM 'completed' AND NEW.status = 'completed')
     AND COALESCE(NEW.barbeiro_confirmou, false) = true
     AND COALESCE(NEW.ponto_liberado, false) = false
     AND COALESCE(NEW.is_free, false) = false
  THEN
    SELECT nome INTO v_service_name FROM public.servicos WHERE id = NEW.servico_id;
    IF lower(coalesce(v_service_name,'')) NOT LIKE '%corte%' THEN
      INSERT INTO public.loyalty_audit_logs (user_id, action, reason, appointment_id, metadata)
      VALUES (NEW.user_id, 'award_blocked', 'Serviço não é um corte (' || coalesce(v_service_name,'?') || ')', NEW.id, jsonb_build_object('service_id', NEW.servico_id));
      NEW.ponto_liberado = true;
      RETURN NEW;
    END IF;

    SELECT EXISTS(
      SELECT 1 FROM public.loyalty_audit_logs
      WHERE user_id = NEW.user_id AND action = 'award_success' AND created_at::date = CURRENT_DATE
    ) INTO v_last_point_today;

    IF v_last_point_today THEN
      INSERT INTO public.loyalty_audit_logs (user_id, action, reason, appointment_id)
      VALUES (NEW.user_id, 'award_blocked', 'Limite diário de pontos atingido (Anti-Fraude)', NEW.id);
      NEW.ponto_liberado = true;
      RETURN NEW;
    END IF;

    SELECT EXISTS(
      SELECT 1 FROM public.resgates
      WHERE user_id = NEW.user_id AND status = 'available'
    ) INTO v_has_active_redemption;

    IF v_has_active_redemption THEN
      INSERT INTO public.loyalty_audit_logs (user_id, action, reason, appointment_id)
      VALUES (NEW.user_id, 'award_blocked', 'Cliente possui corte grátis pendente', NEW.id);
      NEW.ponto_liberado = true;
      RETURN NEW;
    END IF;

    SELECT b.tenant_id INTO v_tenant_id FROM public.barbeiros b WHERE b.id = NEW.barbeiro_id LIMIT 1;

    SELECT p.id, p.pontos_necessarios INTO promo_id, promo_pontos
    FROM public.promocoes p
    WHERE p.ativo = true AND p.tenant_id = v_tenant_id AND lower(coalesce(p.nome, '')) LIKE '%fidelidade%'
    ORDER BY p.created_at DESC LIMIT 1;

    IF promo_id IS NULL THEN
      SELECT p.id, p.pontos_necessarios INTO promo_id, promo_pontos
      FROM public.promocoes p
      WHERE p.ativo = true AND p.tenant_id = v_tenant_id
      ORDER BY p.created_at DESC LIMIT 1;
    END IF;

    IF promo_id IS NULL THEN RETURN NEW; END IF;
    IF promo_pontos IS NULL OR promo_pontos < 1 THEN promo_pontos := 8; END IF;

    SELECT pontos INTO current_points FROM public.pontos WHERE user_id = NEW.user_id;
    IF current_points IS NULL THEN current_points := 0; END IF;

    IF current_points >= promo_pontos THEN
      NEW.ponto_liberado = true;
      RETURN NEW;
    END IF;

    INSERT INTO public.pontos (user_id, pontos, promocao_id, last_awarded_at, updated_at)
    VALUES (NEW.user_id, 1, promo_id, NOW(), NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET pontos = pontos.pontos + 1, last_awarded_at = NOW(), updated_at = NOW()
    RETURNING pontos.pontos INTO current_points;

    INSERT INTO public.loyalty_audit_logs (user_id, action, points_before, points_after, appointment_id)
    VALUES (NEW.user_id, 'award_success', current_points - 1, current_points, NEW.id);

    IF current_points >= promo_pontos THEN
      INSERT INTO public.resgates (user_id, promocao_id, status, created_at, expired_at)
      VALUES (NEW.user_id, promo_id, 'available', NOW(), NOW() + INTERVAL '90 days');
      
      INSERT INTO public.loyalty_audit_logs (user_id, action, reason, points_before, points_after)
      VALUES (NEW.user_id, 'redemption_available', 'Atingiu pontuação para corte grátis', current_points, current_points);
    END IF;

    NEW.ponto_liberado = true;
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. HARDEN CONSUME REDEMPTION
CREATE OR REPLACE FUNCTION public.consume_redemption_on_appointment_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_redemption_id uuid;
  v_service_name text;
  v_points integer;
BEGIN
  IF COALESCE(NEW.payment_method, '') <> 'resgate' THEN
    RETURN NEW;
  END IF;

  SELECT nome INTO v_service_name FROM public.servicos WHERE id = NEW.servico_id;
  IF lower(coalesce(v_service_name,'')) NOT LIKE '%corte%' THEN
    INSERT INTO public.loyalty_audit_logs (user_id, action, reason, metadata)
    VALUES (NEW.user_id, 'redemption_blocked', 'Serviço inválido: ' || coalesce(v_service_name,'?'), jsonb_build_object('service_id', NEW.servico_id));
    RAISE EXCEPTION 'O corte grátis só pode ser aplicado em serviços de Corte.';
  END IF;

  SELECT COALESCE(pontos, 0) INTO v_points FROM public.pontos WHERE user_id = NEW.user_id;
  IF v_points IS NULL THEN v_points := 0; END IF;

  SELECT r.id INTO v_redemption_id
  FROM public.resgates r
  WHERE r.user_id = NEW.user_id
    AND r.status = 'available'
    AND r.used_at IS NULL
    AND (r.expired_at IS NULL OR r.expired_at > now())
  ORDER BY r.created_at ASC
  FOR UPDATE SKIP LOCKED LIMIT 1;

  IF v_redemption_id IS NULL THEN
    INSERT INTO public.loyalty_audit_logs (user_id, action, reason, points_before)
    VALUES (NEW.user_id, 'redemption_blocked', 'Sem resgate disponível', v_points);
    RAISE EXCEPTION 'Nenhum corte grátis disponível para resgate.';
  END IF;

  UPDATE public.resgates SET status = 'used', used_at = now(), appointment_id = NEW.id WHERE id = v_redemption_id;
  UPDATE public.pontos SET pontos = 0, updated_at = now() WHERE user_id = NEW.user_id;

  INSERT INTO public.loyalty_audit_logs (user_id, action, reason, points_before, points_after, appointment_id)
  VALUES (NEW.user_id, 'redemption_success', 'Corte grátis utilizado', v_points, 0, NEW.id);

  NEW.usado_redemption_id := v_redemption_id;
  NEW.is_free := true;
  IF NEW.preco IS NULL OR NEW.preco <= 0 THEN
    NEW.preco := 0;
  END IF;

  RETURN NEW;
END;
$function$;

-- 5. DATA CLEANUP & FRAUD AUDIT
WITH suspicious AS (
  SELECT user_id, data, COUNT(*) as completions
  FROM public.agendamentos
  WHERE status = 'completed'
  GROUP BY user_id, data
  HAVING COUNT(*) > 1
)
INSERT INTO public.loyalty_audit_logs (user_id, action, reason, metadata)
SELECT user_id, 'fraud_detected', 'Múltiplas finalizações em ' || data || ' (' || completions || ')', jsonb_build_object('date', data, 'count', completions)
FROM suspicious;

-- Reset pontos de quem teve >2 finalizações no mesmo dia (recente)
UPDATE public.pontos 
SET pontos = 0, updated_at = NOW() 
WHERE user_id IN (
  SELECT DISTINCT user_id FROM public.agendamentos
  WHERE status = 'completed' AND created_at > (NOW() - INTERVAL '60 days')
  GROUP BY user_id, data
  HAVING COUNT(*) > 2
);

-- Expirar resgates 'available' de usuários com forte indicio de fraude
UPDATE public.resgates
SET status = 'expired', expired_at = NOW()
WHERE status = 'available'
  AND user_id IN (
    SELECT DISTINCT user_id FROM public.agendamentos
    WHERE status = 'completed' AND created_at > (NOW() - INTERVAL '60 days')
    GROUP BY user_id, data
    HAVING COUNT(*) > 3
  );
