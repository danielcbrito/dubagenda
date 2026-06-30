CREATE OR REPLACE FUNCTION public.consume_available_redemptions_as_lost(
  p_user_id uuid,
  p_appointment_id uuid DEFAULT NULL,
  p_reason text DEFAULT 'paid_booking_without_redemption'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_points_before integer := 0;
  v_expired_count integer := 0;
  v_redemption_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id é obrigatório';
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Sem permissão para consumir resgate de outro usuário';
  END IF;

  SELECT COALESCE(pontos, 0)
    INTO v_points_before
  FROM public.pontos
  WHERE user_id = p_user_id;

  IF v_points_before IS NULL THEN
    v_points_before := 0;
  END IF;

  SELECT COALESCE(array_agg(id ORDER BY created_at ASC), ARRAY[]::uuid[])
    INTO v_redemption_ids
  FROM public.resgates
  WHERE user_id = p_user_id
    AND status = 'available'
    AND used_at IS NULL;

  IF COALESCE(array_length(v_redemption_ids, 1), 0) = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'expired_count', 0,
      'points_before', v_points_before,
      'points_after', v_points_before
    );
  END IF;

  UPDATE public.resgates
  SET
    status = 'expired',
    expired_at = now(),
    appointment_id = COALESCE(p_appointment_id, appointment_id)
  WHERE id = ANY(v_redemption_ids);

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;

  UPDATE public.pontos
  SET pontos = 0,
      updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.loyalty_audit_logs (
    user_id,
    action,
    reason,
    points_before,
    points_after,
    appointment_id,
    metadata
  ) VALUES (
    p_user_id,
    'redemption_lost_paid_booking',
    p_reason,
    v_points_before,
    0,
    p_appointment_id,
    jsonb_build_object('redemption_ids', v_redemption_ids)
  );

  RETURN jsonb_build_object(
    'success', true,
    'expired_count', v_expired_count,
    'points_before', v_points_before,
    'points_after', 0,
    'redemption_ids', v_redemption_ids
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_available_redemption_as_used(
  p_user_id uuid,
  p_appointment_id uuid,
  p_reason text DEFAULT 'free_haircut_used'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_points_before integer := 0;
  v_redemption_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_appointment_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id e p_appointment_id são obrigatórios';
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Sem permissão para usar resgate de outro usuário';
  END IF;

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
        is_free = true
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
      is_free = true
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
    jsonb_build_object('redemption_id', v_redemption_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'redemption_id', v_redemption_id,
    'points_before', v_points_before,
    'points_after', 0
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.consume_available_redemptions_as_lost(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_available_redemption_as_used(uuid, uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.consume_available_redemptions_as_lost(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_available_redemption_as_used(uuid, uuid, text) TO authenticated, service_role;