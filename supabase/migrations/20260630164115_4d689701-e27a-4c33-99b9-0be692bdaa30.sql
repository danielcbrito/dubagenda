CREATE OR REPLACE FUNCTION public.user_has_active_redemption_appointment(
  p_user_id uuid,
  p_exclude_appointment_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.agendamentos a
    WHERE a.user_id = p_user_id
      AND a.status IN ('pending', 'confirmed')
      AND (p_exclude_appointment_id IS NULL OR a.id <> p_exclude_appointment_id)
      AND (
        a.payment_method = 'resgate'
        OR a.usado_redemption_id IS NOT NULL
        OR EXISTS (
          SELECT 1
          FROM public.resgates r
          WHERE r.user_id = p_user_id
            AND r.appointment_id = a.id
            AND r.status = 'used'
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_has_active_redemption_appointment(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_active_redemption_appointment(uuid, uuid) TO service_role;

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

  -- Chamadas internas controladas por RPCs SECURITY DEFINER do sistema de fidelidade.
  IF current_setting('app.loyalty_rpc', true) = '1' THEN RETURN NEW; END IF;
  
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

CREATE OR REPLACE FUNCTION public.consume_redemption_on_appointment_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_redemption_id uuid;
  v_service_name text;
  v_service_lower text;
  v_points integer;
  v_combo_kw text;
BEGIN
  IF COALESCE(NEW.payment_method, '') <> 'resgate' THEN
    RETURN NEW;
  END IF;

  IF public.user_has_active_redemption_appointment(NEW.user_id, NEW.id) THEN
    INSERT INTO public.loyalty_audit_logs (user_id, action, reason, appointment_id, metadata)
    VALUES (
      NEW.user_id,
      'redemption_blocked',
      'Cliente já possui agendamento ativo com corte grátis',
      NEW.id,
      jsonb_build_object('blocked_by', 'active_free_appointment')
    );
    RAISE EXCEPTION 'Você já tem um agendamento ativo usando Corte Grátis. Cancele esse agendamento para usar o benefício novamente.';
  END IF;

  SELECT nome INTO v_service_name FROM public.servicos WHERE id = NEW.servico_id;
  v_service_lower := lower(coalesce(v_service_name,''));

  IF v_service_lower NOT LIKE '%corte%' THEN
    INSERT INTO public.loyalty_audit_logs (user_id, action, reason, metadata)
    VALUES (NEW.user_id, 'redemption_blocked', 'Serviço inválido: ' || coalesce(v_service_name,'?'),
            jsonb_build_object('service_id', NEW.servico_id, 'service_name', v_service_name));
    RAISE EXCEPTION 'O corte grátis só pode ser aplicado em um serviço de Corte simples.';
  END IF;

  FOREACH v_combo_kw IN ARRAY ARRAY['barba','+',' e ','mais','combo','pacote','duo','kit']
  LOOP
    IF position(v_combo_kw in v_service_lower) > 0 THEN
      INSERT INTO public.loyalty_audit_logs (user_id, action, reason, metadata)
      VALUES (NEW.user_id, 'redemption_blocked',
              'Combo bloqueado: ' || coalesce(v_service_name,'?'),
              jsonb_build_object('service_id', NEW.servico_id, 'service_name', v_service_name, 'matched_keyword', v_combo_kw));
      RAISE EXCEPTION 'O corte grátis vale apenas para o serviço de Corte simples (sem combos ou serviços adicionais).';
    END IF;
  END LOOP;

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

  UPDATE public.resgates
  SET status = 'used',
      used_at = now(),
      appointment_id = NEW.id
  WHERE id = v_redemption_id;

  UPDATE public.pontos
  SET pontos = 0,
      updated_at = now()
  WHERE user_id = NEW.user_id;

  INSERT INTO public.loyalty_audit_logs (user_id, action, reason, points_before, points_after, appointment_id, metadata)
  VALUES (
    NEW.user_id,
    'redemption_success',
    'Corte grátis utilizado',
    v_points,
    0,
    NEW.id,
    jsonb_build_object('redemption_id', v_redemption_id)
  );

  NEW.usado_redemption_id := v_redemption_id;
  NEW.is_free := true;
  NEW.payment_method := 'resgate';
  NEW.preco := 0;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_available_redemption_as_used(
  p_user_id uuid,
  p_appointment_id uuid,
  p_reason text DEFAULT 'free_haircut_used'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_points_before integer := 0;
  v_redemption_id uuid;
  v_appointment_price numeric := 0;
BEGIN
  IF p_user_id IS NULL OR p_appointment_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id e p_appointment_id são obrigatórios';
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Sem permissão para usar resgate de outro usuário';
  END IF;

  SELECT COALESCE(preco, 0)
    INTO v_appointment_price
  FROM public.agendamentos
  WHERE id = p_appointment_id
    AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado para este cliente.';
  END IF;

  SELECT id INTO v_redemption_id
  FROM public.resgates
  WHERE user_id = p_user_id
    AND appointment_id = p_appointment_id
    AND status = 'used'
  ORDER BY used_at DESC NULLS LAST
  LIMIT 1;

  IF v_redemption_id IS NOT NULL THEN
    PERFORM set_config('app.loyalty_rpc', '1', true);

    UPDATE public.agendamentos
    SET usado_redemption_id = v_redemption_id,
        is_free = (COALESCE(v_appointment_price, 0) <= 0),
        payment_method = CASE WHEN COALESCE(v_appointment_price, 0) <= 0 THEN 'resgate' ELSE payment_method END
    WHERE id = p_appointment_id
      AND user_id = p_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'redemption_id', v_redemption_id,
      'already_used', true
    );
  END IF;

  IF public.user_has_active_redemption_appointment(p_user_id, p_appointment_id) THEN
    INSERT INTO public.loyalty_audit_logs (user_id, action, reason, appointment_id, metadata)
    VALUES (
      p_user_id,
      'redemption_blocked',
      'Cliente já possui agendamento ativo com corte grátis',
      p_appointment_id,
      jsonb_build_object('blocked_by', 'active_free_appointment')
    );
    RAISE EXCEPTION 'Você já tem um agendamento ativo usando Corte Grátis. Cancele esse agendamento para usar o benefício novamente.';
  END IF;

  SELECT COALESCE(pontos, 0)
    INTO v_points_before
  FROM public.pontos
  WHERE user_id = p_user_id;

  IF v_points_before IS NULL THEN
    v_points_before := 0;
  END IF;

  SELECT r.id INTO v_redemption_id
  FROM public.resgates r
  WHERE r.user_id = p_user_id
    AND r.status = 'available'
    AND r.used_at IS NULL
    AND (r.expired_at IS NULL OR r.expired_at > now())
  ORDER BY r.created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_redemption_id IS NULL THEN
    INSERT INTO public.loyalty_audit_logs (user_id, action, reason, points_before, appointment_id)
    VALUES (p_user_id, 'redemption_blocked', 'Sem resgate disponível para marcar como usado', v_points_before, p_appointment_id);
    RAISE EXCEPTION 'Nenhum corte grátis disponível para resgate.';
  END IF;

  UPDATE public.resgates
  SET status = 'used',
      used_at = now(),
      appointment_id = p_appointment_id
  WHERE id = v_redemption_id;

  UPDATE public.pontos
  SET pontos = 0,
      updated_at = now()
  WHERE user_id = p_user_id;

  PERFORM set_config('app.loyalty_rpc', '1', true);

  UPDATE public.agendamentos
  SET usado_redemption_id = v_redemption_id,
      is_free = (COALESCE(v_appointment_price, 0) <= 0),
      payment_method = CASE WHEN COALESCE(v_appointment_price, 0) <= 0 THEN 'resgate' ELSE payment_method END
  WHERE id = p_appointment_id
    AND user_id = p_user_id;

  INSERT INTO public.loyalty_audit_logs (user_id, action, reason, points_before, points_after, appointment_id, metadata)
  VALUES (
    p_user_id,
    'redemption_success',
    p_reason,
    v_points_before,
    0,
    p_appointment_id,
    jsonb_build_object('redemption_id', v_redemption_id, 'appointment_price', v_appointment_price)
  );

  RETURN jsonb_build_object(
    'success', true,
    'redemption_id', v_redemption_id,
    'points_before', v_points_before,
    'points_after', 0,
    'appointment_price', v_appointment_price
  );
END;
$function$;

DROP TRIGGER IF EXISTS trg_consume_redemption_on_appointment_insert ON public.agendamentos;
CREATE TRIGGER trg_consume_redemption_on_appointment_insert
BEFORE INSERT ON public.agendamentos
FOR EACH ROW
EXECUTE FUNCTION public.consume_redemption_on_appointment_insert();