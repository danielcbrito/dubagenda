-- Forçar criação de resgate para o usuário específico se ele tiver pontos mas nenhum resgate
-- E corrigir a detecção de promoção ativa para Barbearia DUB (id: 73d61f2f-b369-41f3-8915-8e6de52d6378)
DO $$
DECLARE
    v_user_id UUID := '6fb5387c-465d-4a50-801b-e80319bdf160';
    v_tenant_id UUID := '73d61f2f-b369-41f3-8915-8e6de52d6378';
    v_promo_id UUID;
    v_points INTEGER;
    v_required INTEGER := 8;
BEGIN
    -- Garantir que existe uma promoção de fidelidade ativa para a Barbearia DUB
    SELECT id, pontos_necessarios INTO v_promo_id, v_required FROM public.promocoes 
    WHERE tenant_id = v_tenant_id AND ativo = true ORDER BY created_at DESC LIMIT 1;
    
    IF v_promo_id IS NULL THEN
        INSERT INTO public.promocoes (nome, descricao, pontos_necessarios, ativo, tenant_id, created_at)
        VALUES ('Fidelidade DUB', 'Ganhe 1 corte grátis a cada 8 cortes realizados', 8, true, v_tenant_id, NOW())
        RETURNING id INTO v_promo_id;
    END IF;

    -- Atualizar os pontos do usuário para garantir que ele tenha os 8 pontos e o promo_id correto
    INSERT INTO public.pontos (user_id, pontos, promocao_id, updated_at)
    VALUES (v_user_id, 8, v_promo_id, NOW())
    ON CONFLICT (user_id) DO UPDATE SET 
        pontos = 8, 
        promocao_id = v_promo_id,
        updated_at = NOW();

    -- Criar o resgate disponível
    IF NOT EXISTS (SELECT 1 FROM public.resgates WHERE user_id = v_user_id AND status = 'available') THEN
        INSERT INTO public.resgates (user_id, promocao_id, status, created_at, expired_at)
        VALUES (v_user_id, v_promo_id, 'available', NOW(), NOW() + INTERVAL '90 days');
        
        INSERT INTO public.loyalty_audit_logs (user_id, action, reason, points_before, points_after)
        VALUES (v_user_id, 'redemption_available', 'Ajuste manual para cliente DUB (D.)', 8, 8);
    END IF;
END $$;