CREATE OR REPLACE FUNCTION public.user_has_active_redemption_appointment(
  p_user_id uuid,
  p_exclude_appointment_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF auth.uid() IS NOT NULL
     AND auth.uid() <> p_user_id
     AND NOT public.has_role(auth.uid(), 'admin'::app_role)
     AND NOT public.has_role(auth.uid(), 'ti'::app_role)
  THEN
    RAISE EXCEPTION 'Sem permissão para consultar outro usuário';
  END IF;

  RETURN EXISTS (
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
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_has_active_redemption_appointment(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_active_redemption_appointment(uuid, uuid) TO service_role;