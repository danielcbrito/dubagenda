CREATE OR REPLACE FUNCTION public.mark_available_redemption_as_used(p_user_id uuid, p_appointment_id uuid, p_reason text DEFAULT 'free_haircut_used'::text)
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

  SELECT id INTO v_redemption_id
  FROM public.resgates
  WHERE user_id = p_user_id
    AND appointment_id = p_appointment_id
    AND status = 'used'
  ORDER BY used_at DESC NULLS LAST
  LIMIT 1;

  IF v_redemption_id IS NOT NULL THEN
    UPDATE public.agendamentos
    SET usado_redemption_id = v_redemption_id,
        is_free = (COALESCE(v_appointment_price, 0) <= 0)
    WHERE id = p_appointment_id
      AND user_id = p_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'redemption_id', v_redemption_id,
      'already_used', true
    );
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

  UPDATE public.agendamentos
  SET usado_redemption_id = v_redemption_id,
      is_free = (COALESCE(v_appointment_price, 0) <= 0)
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