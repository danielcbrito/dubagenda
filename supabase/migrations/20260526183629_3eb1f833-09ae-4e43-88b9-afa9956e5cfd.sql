-- 1. Tabela de Auditoria de Fidelidade
CREATE TABLE IF NOT EXISTS public.loyalty_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'award_attempt', 'award_success', 'award_blocked', 'redemption_attempt', 'redemption_success', 'redemption_blocked'
  reason TEXT,
  points_before INTEGER,
  points_after INTEGER,
  appointment_id UUID,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

GRANT SELECT, INSERT ON public.loyalty_audit_logs TO authenticated;
GRANT ALL ON public.loyalty_audit_logs TO service_role;

ALTER TABLE public.loyalty_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own loyalty logs" 
ON public.loyalty_audit_logs 
FOR SELECT 
USING (auth.uid() = user_id);

-- 2. Atualizar Função de Concessão de Pontos (award_loyalty_point)
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
  v_has_previous_redemption boolean;
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

    -- 2. Validar "Uma vez por cliente" (se já teve resgate disponível ou usado)
    SELECT EXISTS(
      SELECT 1 FROM public.resgates
      WHERE user_id = NEW.user_id
    ) INTO v_has_previous_redemption;

    IF v_has_previous_redemption THEN
      INSERT INTO public.loyalty_audit_logs (user_id, action, reason, appointment_id)
      VALUES (NEW.user_id, 'award_blocked', 'Cliente já utilizou ou possui o benefício de corte grátis disponível', NEW.id);
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

    -- Se já tem 8 pontos, não ganha mais (espera resgate)
    IF current_points >= promo_pontos THEN
      INSERT INTO public.loyalty_audit_logs (user_id, action, reason, points_before, points_after, appointment_id)
      VALUES (NEW.user_id, 'award_blocked', 'Limite de pontos atingido. Aguardando resgate.', current_points, current_points, NEW.id);
      NEW.ponto_liberado = true;
      RETURN NEW;
    END IF;

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

    -- Criar resgate se atingiu exatamente os pontos necessários
    IF current_points = promo_pontos THEN
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

-- 3. Atualizar Função de Consumo de Resgate (consume_redemption_on_appointment_insert)
CREATE OR REPLACE FUNCTION public.consume_redemption_on_appointment_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_redemption_id uuid;
  v_service_name text;
  v_points integer;
BEGIN
  -- Só aplica para cortes grátis via resgate
  IF COALESCE(NEW.payment_method, '') <> 'resgate' THEN
    RETURN NEW;
  END IF;

  -- 1. Validar se o serviço é "Corte"
  SELECT nome INTO v_service_name FROM public.servicos WHERE id = NEW.servico_id;
  IF lower(v_service_name) NOT LIKE '%corte%' THEN
    INSERT INTO public.loyalty_audit_logs (user_id, action, reason, metadata)
    VALUES (NEW.user_id, 'redemption_blocked', 'Tentativa de usar corte grátis em serviço inválido: ' || v_service_name, jsonb_build_object('service_id', NEW.servico_id));
    RAISE EXCEPTION 'O benefício de corte grátis só pode ser aplicado a serviços de Corte.';
  END IF;

  -- 2. Validar se tem exatamente 8 pontos (ou o necessário da promoção)
  SELECT pontos INTO v_points FROM public.pontos WHERE user_id = NEW.user_id;
  IF v_points < 8 THEN
    INSERT INTO public.loyalty_audit_logs (user_id, action, reason, points_before)
    VALUES (NEW.user_id, 'redemption_blocked', 'Tentativa de resgate com pontos insuficientes: ' || v_points, v_points);
    RAISE EXCEPTION 'Você precisa de exatamente 8 pontos para resgatar o corte grátis.';
  END IF;

  -- Seleciona 1 resgate disponível
  SELECT r.id
  INTO v_redemption_id
  FROM public.resgates r
  WHERE r.user_id = NEW.user_id
    AND r.status = 'available'
    AND r.used_at IS NULL
    AND (r.expired_at IS NULL OR r.expired_at > now())
  ORDER BY r.created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_redemption_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum resgate disponível encontrado.';
  END IF;

  -- Marca resgate como usado
  UPDATE public.resgates
  SET status = 'used',
      used_at = now(),
      appointment_id = NEW.id
  WHERE id = v_redemption_id;

  -- RESETAR PONTOS PARA 0 após a utilização
  UPDATE public.pontos
  SET pontos = 0,
      updated_at = now()
  WHERE user_id = NEW.user_id;

  INSERT INTO public.loyalty_audit_logs (user_id, action, reason, points_before, points_after, appointment_id)
  VALUES (NEW.user_id, 'redemption_success', 'Corte grátis utilizado com sucesso', v_points, 0, NEW.id);

  -- Garante consistência no agendamento
  NEW.usado_redemption_id := v_redemption_id;
  NEW.is_free := true;
  NEW.preco := 0;

  RETURN NEW;
END;
$function$;

-- 4. Limpeza de Dados e Correção de Vulnerabilidades
-- Capar pontos em 8
UPDATE public.pontos SET pontos = 8 WHERE pontos > 8;

-- Corrigir agendamentos 'is_free' que não são cortes (marcar como pagos ou invalidar se necessário, mas por segurança apenas logamos)
INSERT INTO public.loyalty_audit_logs (user_id, action, reason, appointment_id)
SELECT user_id, 'data_cleanup_warning', 'Agendamento gratuito em serviço que não parece ser corte', id
FROM public.agendamentos
WHERE is_free = true 
  AND servico_id IN (SELECT id FROM public.servicos WHERE lower(nome) NOT LIKE '%corte%');
