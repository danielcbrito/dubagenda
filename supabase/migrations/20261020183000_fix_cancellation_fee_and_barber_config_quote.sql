-- Migration: Correção de Sobrecarga e Resiliência na Consulta de Taxa de Cancelamento
-- 1. Garante que quote_client_cancellation faça chamadas com 5 argumentos explícitos, eliminando erro 42725 (is not unique)
-- 2. Busca dinâmica e resiliente das configurações de taxa do barbeiro (taxa_cancelamento_<barbeiro_id>)
-- 3. Fallbacks seguros para que cancelamentos de plano ou agendamentos sem taxa não quebrem o modal do cliente

CREATE OR REPLACE FUNCTION public.quote_client_cancellation(p_appointment uuid, p_user uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  a public.agendamentos%ROWTYPE;
  t uuid;
  c jsonb := '{}'::jsonb;
  fee numeric := 0;
  base_price numeric := 0;
  apt_start timestamptz;
  now_tz timestamptz := now();
  is_free boolean := true;
  seconds_left double precision;
  paid_amount numeric := 0;
  is_prepaid boolean := false;
BEGIN
  -- Segurança: impede que usuário consulte agendamento de outro
  IF auth.uid() IS NOT NULL AND auth.role() = 'authenticated' AND auth.uid() <> p_user THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  SELECT * INTO a FROM public.agendamentos WHERE id = p_appointment AND user_id = p_user;
  IF NOT FOUND THEN 
    RAISE EXCEPTION 'APPOINTMENT_NOT_OWNED'; 
  END IF;

  -- Obter tenant_id do barbeiro
  IF a.barbeiro_id IS NOT NULL THEN
    SELECT tenant_id INTO t FROM public.barbeiros WHERE id = a.barbeiro_id;
  END IF;

  -- Buscar configuração de cancelamento do barbeiro (chave específica do barbeiro)
  IF a.barbeiro_id IS NOT NULL THEN
    SELECT valor::jsonb INTO c 
    FROM public.informacoes_empresa 
    WHERE chave = 'taxa_cancelamento_' || a.barbeiro_id 
      AND ativo = true
    ORDER BY id DESC
    LIMIT 1;
  END IF;

  -- Fallback: Se não encontrou chave específica, busca configuração geral da barbearia
  IF c IS NULL OR c = '{}'::jsonb THEN
    IF t IS NOT NULL THEN
      SELECT valor::jsonb INTO c 
      FROM public.informacoes_empresa 
      WHERE tenant_id = t 
        AND chave = 'taxa_cancelamento' 
        AND ativo = true
      ORDER BY id DESC
      LIMIT 1;
    ELSE
      SELECT valor::jsonb INTO c 
      FROM public.informacoes_empresa 
      WHERE chave = 'taxa_cancelamento' 
        AND ativo = true
      ORDER BY id DESC
      LIMIT 1;
    END IF;
  END IF;

  IF c IS NULL THEN
    c := '{}'::jsonb;
  END IF;

  -- Preço base do serviço
  SELECT COALESCE(NULLIF(a.preco, 0), s.preco, 0)
  INTO base_price
  FROM public.servicos s
  WHERE s.id = a.servico_id;

  IF base_price IS NULL OR base_price <= 0 THEN
    base_price := COALESCE(a.preco, 0);
  END IF;

  apt_start := (a.data + a.hora) AT TIME ZONE 'America/Sao_Paulo';
  seconds_left := EXTRACT(EPOCH FROM (apt_start - now_tz));

  -- Chamada com 5 argumentos explícitos para eliminar qualquer ambiguidade de overload
  fee := public.cancellation_fee_amount(c, base_price, apt_start, now_tz, false);

  -- É gratuito se faltar mais de 2 horas OU se a taxa calculada for 0 (ex: barbeiro desativou taxa)
  is_free := (seconds_left >= 7200) OR (fee <= 0);

  -- Identificar pré-pagamento (Pix / Gateway / Carteira / Plano)
  IF a.payment_method IN ('pix', 'credit', 'card', 'credit_card', 'wallet') THEN
    is_prepaid := true;
    paid_amount := COALESCE(a.preco, 0);
  END IF;

  RETURN jsonb_build_object(
    'valor_taxa', fee,
    'config', c,
    'tenant_id', t,
    'valor_servico_original', base_price,
    'is_free', is_free,
    'segundos_restantes', seconds_left,
    'horas_restantes', round((seconds_left / 3600.0)::numeric, 2),
    'payment_method', a.payment_method,
    'is_prepaid', is_prepaid,
    'valor_pago', paid_amount,
    'valor_reembolso_estimado', CASE WHEN is_prepaid THEN greatest(0, paid_amount - fee) ELSE 0 END,
    'vai_descontar_reembolso', (is_prepaid AND fee > 0 AND paid_amount >= fee),
    'vai_gerar_divida', (NOT is_prepaid AND fee > 0)
  );
END $$;

REVOKE ALL ON FUNCTION public.quote_client_cancellation(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quote_client_cancellation(uuid, uuid) TO service_role, authenticated;
