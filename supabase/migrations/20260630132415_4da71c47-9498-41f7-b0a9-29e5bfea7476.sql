CREATE OR REPLACE FUNCTION public.consume_redemption_on_paid_appointment_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(NEW.payment_method, '') IN ('cash', 'pix', 'wallet', 'card', 'credit_card', 'credit')
     AND COALESCE(NEW.is_free, false) = false
  THEN
    PERFORM public.consume_available_redemptions_as_lost(
      NEW.user_id,
      NEW.id,
      'paid_booking_without_redemption'
    );
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_consume_redemption_on_paid_appointment_insert ON public.agendamentos;
CREATE TRIGGER trigger_consume_redemption_on_paid_appointment_insert
  AFTER INSERT ON public.agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.consume_redemption_on_paid_appointment_insert();