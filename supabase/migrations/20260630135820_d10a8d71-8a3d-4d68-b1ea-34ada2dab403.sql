CREATE OR REPLACE FUNCTION public.release_redemption_on_appointment_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Restaurar o corte grátis sempre que o agendamento tinha um resgate vinculado
  -- (independente do método de pagamento) ao ser cancelado por cliente OU barbeiro/admin.
  IF NEW.status IN ('cancelled_by_user', 'cancelled_by_admin')
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND OLD.usado_redemption_id IS NOT NULL
  THEN
    UPDATE public.resgates
    SET status = 'available',
        used_at = NULL,
        appointment_id = NULL
    WHERE id = OLD.usado_redemption_id
      AND user_id = NEW.user_id
      AND (expired_at IS NULL OR expired_at > now());

    UPDATE public.agendamentos
    SET usado_redemption_id = NULL,
        updated_at = now()
    WHERE id = NEW.id;

    INSERT INTO public.loyalty_audit_logs (user_id, action, reason, appointment_id, metadata)
    VALUES (NEW.user_id, 'redemption_restored_on_cancel',
            'Corte grátis devolvido após cancelamento',
            NEW.id,
            jsonb_build_object('redemption_id', OLD.usado_redemption_id, 'cancel_status', NEW.status));
  END IF;

  RETURN NEW;
END;
$function$;