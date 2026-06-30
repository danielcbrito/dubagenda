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

    IF public.user_has_active_redemption_appointment(NEW.user_id, NEW.id) THEN
      INSERT INTO public.loyalty_audit_logs (user_id, action, reason, appointment_id, metadata)
      VALUES (
        NEW.user_id,
        'award_blocked',
        'Cliente possui agendamento ativo com corte grátis',
        NEW.id,
        jsonb_build_object('blocked_by', 'active_free_appointment')
      );
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