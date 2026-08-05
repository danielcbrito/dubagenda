-- Forçar criação de resgate para o usuário específico se ele tiver pontos mas nenhum resgate
DO $$
DECLARE
    v_user_id UUID := '6fb5387c-465d-4a50-801b-e80319bdf160';
    v_tenant_id UUID;
    v_promo_id UUID;
    v_points INTEGER;
    v_required INTEGER;
BEGIN
    -- Obter tenant do perfil preferido
    SELECT barbearia_preferida_id INTO v_tenant_id FROM public.profiles WHERE id = v_user_id;
    
    -- Obter pontos atuais
    SELECT pontos, promocao_id INTO v_points, v_promo_id FROM public.pontos WHERE user_id = v_user_id;
    
    -- Se não tem promo_id nos pontos, buscar a ativa do tenant
    IF v_promo_id IS NULL AND v_tenant_id IS NOT NULL THEN
        SELECT id, pontos_necessarios INTO v_promo_id, v_required FROM public.promocoes 
        WHERE tenant_id = v_tenant_id AND ativo = true ORDER BY created_at DESC LIMIT 1;
    ELSEIF v_promo_id IS NOT NULL THEN
        SELECT pontos_necessarios INTO v_required FROM public.promocoes WHERE id = v_promo_id;
    END IF;

    IF v_required IS NULL OR v_required < 2 THEN v_required := 8; END IF;

    -- Se atingiu os pontos mas não tem resgate disponível, CRIAR
    IF v_points >= v_required THEN
        IF NOT EXISTS (SELECT 1 FROM public.resgates WHERE user_id = v_user_id AND status = 'available') THEN
            INSERT INTO public.resgates (user_id, promocao_id, status, created_at, expired_at)
            VALUES (v_user_id, v_promo_id, 'available', NOW(), NOW() + INTERVAL '90 days');
            
            INSERT INTO public.loyalty_audit_logs (user_id, action, reason, points_before, points_after)
            VALUES (v_user_id, 'redemption_available', 'Correção manual: pontos >= meta mas sem resgate', v_points, v_points);
        END IF;
    END IF;
END $$;

-- Melhorar a trigger de pontos para garantir que se o usuário ganhar um ponto e JÁ tiver a meta (ou ultrapassar), o resgate seja criado
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
BEGIN
  -- Libera ponto SOMENTE quando o status muda para 'completed'
  IF (OLD.status IS DISTINCT FROM 'completed' AND NEW.status = 'completed')
     AND COALESCE(NEW.ponto_liberado, false) = false
     AND COALESCE(NEW.is_free, false) = false
  THEN
    -- 1. Validar se o serviço é "Corte"
    SELECT nome INTO v_service_name FROM public.servicos WHERE id = NEW.servico_id;
    IF lower(v_service_name) NOT LIKE '%corte%' THEN
      INSERT INTO public.loyalty_audit_logs (user_id, action, reason, appointment_id, metadata)
      VALUES (NEW.user_id, 'award_blocked', 'Serviço não é um corte (' || v_service_name || ')', NEW.id, jsonb_build_object('service_id', NEW.servico_id));
      NEW.ponto_liberado = true;
      RETURN NEW;
    END IF;

    -- 2. Validar se já possui o benefício de corte grátis DISPONÍVEL (resgate ativo)
    -- Mudança: Não bloqueia acumular pontos se ele usou no passado, mas bloqueia se ele tem um DISPONÍVEL agora.
    SELECT EXISTS(
      SELECT 1 FROM public.resgates
      WHERE user_id = NEW.user_id AND status = 'available'
    ) INTO v_has_active_redemption;

    IF v_has_active_redemption THEN
      INSERT INTO public.loyalty_audit_logs (user_id, action, reason, appointment_id)
      VALUES (NEW.user_id, 'award_blocked', 'Cliente já possui o benefício de corte grátis disponível', NEW.id);
      NEW.ponto_liberado = true;
      RETURN NEW;
    END IF;

    -- Resolve tenant do barbeiro
    SELECT b.tenant_id INTO v_tenant_id FROM public.barbeiros b WHERE b.id = NEW.barbeiro_id LIMIT 1;

    -- Buscar promoção ativa
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
    IF promo_pontos IS NULL OR promo_pontos < 2 THEN promo_pontos := 8; END IF;

    -- Obter pontos atuais
    SELECT pontos INTO current_points FROM public.pontos WHERE user_id = NEW.user_id;
    IF current_points IS NULL THEN current_points := 0; END IF;

    -- Incrementar ponto
    INSERT INTO public.pontos (user_id, pontos, promocao_id, last_awarded_at, updated_at)
    VALUES (NEW.user_id, 1, promo_id, NOW(), NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
      pontos = pontos.pontos + 1,
      last_awarded_at = NOW(),
      updated_at = NOW()
    RETURNING pontos.pontos INTO current_points;

    INSERT INTO public.loyalty_audit_logs (user_id, action, points_before, points_after, appointment_id)
    VALUES (NEW.user_id, 'award_success', current_points - 1, current_points, NEW.id);

    -- Criar resgate se atingiu OU ultrapassou os pontos necessários (resiliência)
    IF current_points >= promo_pontos THEN
      -- Só cria se não existir um disponível
      IF NOT EXISTS (SELECT 1 FROM public.resgates WHERE user_id = NEW.user_id AND status = 'available') THEN
          INSERT INTO public.resgates (user_id, promo_id, status, created_at, expired_at)
          VALUES (NEW.user_id, promo_id, 'available', NOW(), NOW() + INTERVAL '90 days');
          
          INSERT INTO public.loyalty_audit_logs (user_id, action, reason, points_before, points_after)
          VALUES (NEW.user_id, 'redemption_available', 'Atingiu pontuação para corte grátis', current_points, current_points);
          
          -- Capar pontos no valor necessário para evitar confusão visual
          UPDATE public.pontos SET pontos = promo_pontos WHERE user_id = NEW.user_id;
      END IF;
    END IF;

    NEW.ponto_liberado = true;
  END IF;

  RETURN NEW;
END;
$function$;