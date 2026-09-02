
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

  SELECT nome INTO v_service_name FROM public.servicos WHERE id = NEW.servico_id;
  v_service_lower := lower(coalesce(v_service_name,''));

  -- Deve conter "corte"
  IF v_service_lower NOT LIKE '%corte%' THEN
    INSERT INTO public.loyalty_audit_logs (user_id, action, reason, metadata)
    VALUES (NEW.user_id, 'redemption_blocked', 'Serviço inválido: ' || coalesce(v_service_name,'?'),
            jsonb_build_object('service_id', NEW.servico_id, 'service_name', v_service_name));
    RAISE EXCEPTION 'O corte grátis só pode ser aplicado em um serviço de Corte simples.';
  END IF;

  -- Bloquear combos: corte grátis vale APENAS para corte sozinho
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
