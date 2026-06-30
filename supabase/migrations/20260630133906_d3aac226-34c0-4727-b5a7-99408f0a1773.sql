CREATE OR REPLACE FUNCTION public.consume_redemption_on_paid_appointment_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(NEW.tipo_agendamento, 'regular') = 'encaixe_manual' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.payment_method, '') IN ('cash', 'pix', 'wallet', 'card', 'credit_card', 'credit') THEN
    IF COALESCE(NEW.observacoes, '') ILIKE '%Corte Grátis%'
       OR COALESCE(NEW.observacoes, '') ILIKE '%Corte grátis%'
       OR COALESCE(NEW.observacoes, '') ILIKE '%Resgate de Corte%'
    THEN
      PERFORM public.mark_available_redemption_as_used(
        NEW.user_id,
        NEW.id,
        'free_haircut_used_from_paid_booking'
      );
    ELSE
      PERFORM public.consume_available_redemptions_as_lost(
        NEW.user_id,
        NEW.id,
        'paid_booking_without_redemption'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;