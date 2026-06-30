CREATE OR REPLACE FUNCTION public.consume_redemption_on_paid_appointment_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(NEW.payment_method, '') IN ('cash', 'pix', 'wallet', 'card', 'credit_card', 'credit')
     AND COALESCE(NEW.is_free, false) = false
     AND COALESCE(NEW.tipo_agendamento, 'regular') <> 'encaixe_manual'
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