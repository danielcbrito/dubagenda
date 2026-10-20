-- Migration: Atualização Completa do Sistema de Taxas de Cancelamento, Falta (No-Show) e Dívidas Integradas
-- Regra de negócio:
-- 1. Cancelamento gratuito até 2 horas antes do agendamento (regra do sistema, não alterável pelo barbeiro).
-- 2. Cancelamento com menos de 2 horas ou falta (no-show) aplica a taxa configurada pelo barbeiro (% ou fixo).
-- 3. Débitos pendentes não bloqueiam a navegação nem impedem novos agendamentos: o valor da dívida é somado no próximo checkout.
-- 4. Suporte ao acúmulo de múltiplas taxas com histórico detalhado (itens).

-- 1. Remover triggers que bloqueavam novos agendamentos e pending_bookings
DROP TRIGGER IF EXISTS trg_guard_pending_cancellation_debt ON public.agendamentos;
DROP TRIGGER IF EXISTS trg_guard_pending_cancellation_debt ON public.pending_bookings;
DROP FUNCTION IF EXISTS public.guard_pending_cancellation_debt();

-- 2. Atualizar cálculo da taxa no banco com a regra fixa de 2 horas (120 minutos = 7200 segundos)
CREATE OR REPLACE FUNCTION public.cancellation_fee_amount(
  p_config jsonb,
  p_price numeric,
  p_start timestamptz,
  p_now timestamptz,
  p_is_no_show boolean DEFAULT false
) RETURNS numeric LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  v numeric;
  tipo text;
BEGIN
  IF p_config->'habilitado' IS DISTINCT FROM 'true'::jsonb THEN
    RETURN 0;
  END IF;

  tipo := COALESCE(p_config->>'tipo', 'porcentagem');
  IF tipo NOT IN ('porcentagem', 'fixo') THEN
    RAISE EXCEPTION 'INVALID_CANCELLATION_CONFIG';
  END IF;

  v := COALESCE((p_config->>'valor')::numeric, 20);
  IF v < 0 OR (tipo = 'porcentagem' AND v > 100) THEN
    RAISE EXCEPTION 'INVALID_CANCELLATION_CONFIG';
  END IF;

  -- Regra do sistema: cancelamento gratuito até 2 horas antes (7200 segundos)
  -- Se for falta (no-show), sempre cobra
  IF NOT p_is_no_show AND (p_start - p_now > interval '2 hours') THEN
    RETURN 0;
  END IF;

  RETURN round(
    CASE 
      WHEN tipo = 'fixo' THEN v 
      ELSE greatest(COALESCE(p_price, 0), 0) * v / 100 
    END,
    2
  );
END $$;

REVOKE ALL ON FUNCTION public.cancellation_fee_amount(jsonb, numeric, timestamptz, timestamptz, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancellation_fee_amount(jsonb, numeric, timestamptz, timestamptz, boolean) TO service_role;

-- 3. Atualizar consulta da taxa (quote_client_cancellation)
CREATE OR REPLACE FUNCTION public.quote_client_cancellation(p_appointment uuid, p_user uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  a public.agendamentos%ROWTYPE;
  t uuid;
  c jsonb := '{}';
  n integer;
  fee numeric;
  base_price numeric;
  apt_start timestamptz;
  now_tz timestamptz := now();
  is_free boolean;
  seconds_left double precision;
  paid_amount numeric := 0;
  is_prepaid boolean := false;
BEGIN
  SELECT * INTO a FROM public.agendamentos WHERE id = p_appointment AND user_id = p_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'APPOINTMENT_NOT_OWNED'; END IF;

  SELECT tenant_id INTO t FROM public.barbeiros WHERE id = a.barbeiro_id;
  IF t IS NULL THEN RAISE EXCEPTION 'TENANT_REQUIRED'; END IF;

  SELECT count(*) INTO n FROM public.informacoes_empresa WHERE tenant_id = t AND chave = 'taxa_cancelamento_' || a.barbeiro_id AND ativo = true;
  IF n > 1 THEN RAISE EXCEPTION 'DUPLICATE_CANCELLATION_CONFIG'; END IF;

  SELECT valor::jsonb INTO c FROM public.informacoes_empresa WHERE tenant_id = t AND chave = 'taxa_cancelamento_' || a.barbeiro_id AND ativo = true;

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
  is_free := seconds_left >= 7200; -- >= 2 horas

  fee := public.cancellation_fee_amount(COALESCE(c, '{}'), base_price, apt_start, now_tz, false);

  -- Identificar pré-pagamento (Pix / Gateway)
  IF a.payment_method IN ('pix', 'credit', 'card', 'credit_card', 'wallet') THEN
    is_prepaid := true;
    paid_amount := COALESCE(a.preco, 0);
  END IF;

  RETURN jsonb_build_object(
    'valor_taxa', fee,
    'config', COALESCE(c, '{}'),
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

REVOKE ALL ON FUNCTION public.quote_client_cancellation(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quote_client_cancellation(uuid, uuid) TO service_role;

-- 4. Função para registrar/acumular dívida do cliente (com suporte a cancelamento tardio e falta)
CREATE OR REPLACE FUNCTION public.record_client_cancellation_debt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  q jsonb;
  fee numeric;
  existing public.informacoes_empresa%ROWTYPE;
  existing_val jsonb;
  existing_itens jsonb;
  new_item jsonb;
  total_pendente numeric;
  t uuid;
  client_name text;
  client_phone text;
  barber_name text;
  orig_price numeric;
  is_no_show boolean := false;
  motivo text;
BEGIN
  -- Dispara apenas para cancelamento pelo cliente ou falta (no-show)
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'cancelled_by_user' AND OLD.status IN ('pending', 'confirmed') THEN
    motivo := 'cancelamento_tardio';
    is_no_show := false;
  ELSIF NEW.status = 'no_show' AND OLD.status IN ('pending', 'confirmed') THEN
    motivo := 'falta';
    is_no_show := true;
  ELSE
    RETURN NEW;
  END IF;

  -- Se foi pago via Pix/cartão e o cancelamento é pelo cliente, o edge function cancel-appointment-client
  -- desconta a taxa diretamente do estorno (reembolso líquido). Portanto, não cria dívida.
  IF NEW.status = 'cancelled_by_user' AND NEW.payment_method IN ('pix', 'card', 'credit_card', 'credit', 'wallet') AND COALESCE(NEW.preco, 0) > 0 THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('cancel-debt:' || NEW.user_id::text, 0));

  q := public.quote_client_cancellation(NEW.id, NEW.user_id);
  fee := (q->>'valor_taxa')::numeric;
  t := (q->>'tenant_id')::uuid;

  -- Para falta (no-show), sempre recalcula sem a janela de 2h
  IF is_no_show THEN
    fee := public.cancellation_fee_amount(
      COALESCE(q->'config', '{}'::jsonb),
      (q->>'valor_servico_original')::numeric,
      now(),
      now(),
      true
    );
  END IF;

  IF fee <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT * INTO existing FROM public.informacoes_empresa
  WHERE tenant_id = t AND categoria = 'debitos_cliente' AND chave = 'debito_cancelamento_' || NEW.user_id
  FOR UPDATE;

  SELECT nome, telefone INTO client_name, client_phone FROM public.profiles WHERE id = NEW.user_id;
  SELECT apelido INTO barber_name FROM public.barbeiros WHERE id = NEW.barbeiro_id;

  orig_price := COALESCE(NULLIF((q->>'valor_servico_original')::numeric, 0), NEW.preco, 0);

  new_item := jsonb_build_object(
    'id', gen_random_uuid(),
    'agendamento_id', NEW.id,
    'barbeiro_id', NEW.barbeiro_id,
    'barbeiro_nome', COALESCE(barber_name, 'Barbeiro'),
    'motivo', motivo,
    'valor_taxa', fee,
    'tipo_taxa', COALESCE(q->'config'->>'tipo', 'porcentagem'),
    'porcentagem_aplicada', CASE WHEN COALESCE(q->'config'->>'tipo', 'porcentagem') = 'porcentagem' THEN COALESCE((q->'config'->>'valor')::numeric, 20) ELSE NULL END,
    'valor_servico_original', orig_price,
    'status', 'pendente',
    'created_at', now(),
    'tenant_id', t
  );

  IF existing.id IS NOT NULL AND existing.valor IS NOT NULL THEN
    existing_val := existing.valor::jsonb;
    
    -- Se já existiam itens em array, adiciona o novo item
    IF existing_val ? 'itens' AND jsonb_typeof(existing_val->'itens') = 'array' THEN
      existing_itens := existing_val->'itens';
    ELSE
      -- Converte registro legado simples em array de itens
      existing_itens := jsonb_build_array(existing_val);
    END IF;

    existing_itens := existing_itens || jsonb_build_array(new_item);

    -- Calcula novo total pendente somando itens com status 'pendente'
    SELECT COALESCE(SUM((item->>'valor_taxa')::numeric), 0)
    INTO total_pendente
    FROM jsonb_array_elements(existing_itens) AS item
    WHERE item->>'status' = 'pendente';

    existing_val := jsonb_build_object(
      'id', COALESCE(existing_val->>'id', gen_random_uuid()::text),
      'cliente_id', NEW.user_id,
      'cliente_nome', COALESCE(client_name, existing_val->>'cliente_nome', ''),
      'cliente_telefone', COALESCE(client_phone, existing_val->>'cliente_telefone', ''),
      'total_pendente', total_pendente,
      'valor_taxa', total_pendente, -- retrocompatibilidade
      'status', CASE WHEN total_pendente > 0 THEN 'pendente' ELSE 'pago' END,
      'itens', existing_itens,
      'tenant_id', t,
      'updated_at', now()
    );

    UPDATE public.informacoes_empresa
    SET valor = existing_val::text, ativo = true, atualizado_em = now()
    WHERE id = existing.id;
  ELSE
    -- Primeiro débito do cliente
    existing_val := jsonb_build_object(
      'id', gen_random_uuid(),
      'cliente_id', NEW.user_id,
      'cliente_nome', COALESCE(client_name, ''),
      'cliente_telefone', COALESCE(client_phone, ''),
      'total_pendente', fee,
      'valor_taxa', fee,
      'status', 'pendente',
      'itens', jsonb_build_array(new_item),
      'tenant_id', t,
      'created_at', now()
    );

    INSERT INTO public.informacoes_empresa(tenant_id, chave, categoria, valor, ativo)
    VALUES(t, 'debito_cancelamento_' || NEW.user_id, 'debitos_cliente', existing_val::text, true);
  END IF;

  -- Criar notificação para o cliente
  INSERT INTO public.notificacoes(user_id, tipo, titulo, mensagem, agendamento_id, created_at)
  VALUES (
    NEW.user_id,
    'taxa_pendente',
    CASE WHEN is_no_show THEN 'Taxa por não comparecimento' ELSE 'Taxa de cancelamento registrada' END,
    CASE 
      WHEN is_no_show THEN 'Você não compareceu ao atendimento. Uma taxa de R$ ' || to_char(fee, 'FM999G990D00') || ' foi registrada e será somada no seu próximo agendamento.'
      ELSE 'Cancelamento realizado com menos de 2h de antecedência. Taxa de R$ ' || to_char(fee, 'FM999G990D00') || ' registrada para seu próximo agendamento.'
    END,
    NEW.id,
    now()
  );

  RETURN NEW;
END $function$;

REVOKE ALL ON FUNCTION public.record_client_cancellation_debt() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_client_cancellation_debt() TO service_role;

-- 5. Atualizar função de leitura de dívidas para o cliente logado
CREATE OR REPLACE FUNCTION public.get_my_cancellation_debts()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'row_id', id,
        'tenant_id', tenant_id,
        'debito', valor::jsonb
      ) ORDER BY atualizado_em DESC
    ),
    '[]'::jsonb
  )
  FROM public.informacoes_empresa
  WHERE tenant_id IS NOT NULL
    AND categoria = 'debitos_cliente'
    AND chave = 'debito_cancelamento_' || auth.uid()::text
    AND (
      valor::jsonb->>'status' = 'pendente' 
      OR (valor::jsonb ? 'total_pendente' AND (valor::jsonb->>'total_pendente')::numeric > 0)
    );
$$;

REVOKE ALL ON FUNCTION public.get_my_cancellation_debts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_cancellation_debts() TO authenticated;

-- 6. Quitar todas as dívidas pendentes de um cliente (chamada quando o cliente paga via Pix ou na barbearia)
CREATE OR REPLACE FUNCTION public.settle_client_debts(p_client_id uuid, p_correlation text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.informacoes_empresa%ROWTYPE;
  val jsonb;
  itens jsonb;
  updated_itens jsonb := '[]'::jsonb;
  item jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('cancel-debt:' || p_client_id::text, 0));

  SELECT * INTO r FROM public.informacoes_empresa
  WHERE categoria = 'debitos_cliente' AND chave = 'debito_cancelamento_' || p_client_id::text
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'settled', 0);
  END IF;

  val := r.valor::jsonb;
  IF val ? 'itens' AND jsonb_typeof(val->'itens') = 'array' THEN
    itens := val->'itens';
    FOR item IN SELECT * FROM jsonb_array_elements(itens)
    LOOP
      IF item->>'status' = 'pendente' THEN
        item := item || jsonb_build_object('status', 'pago', 'paid_at', now(), 'correlation_id', p_correlation);
      END IF;
      updated_itens := updated_itens || jsonb_build_array(item);
    END LOOP;
  ELSE
    -- Legado simples
    updated_itens := jsonb_build_array(val || jsonb_build_object('status', 'pago', 'paid_at', now(), 'correlation_id', p_correlation));
  END IF;

  val := val || jsonb_build_object(
    'status', 'pago',
    'total_pendente', 0,
    'valor_taxa', 0,
    'paid_at', now(),
    'correlation_id', p_correlation,
    'itens', updated_itens
  );

  UPDATE public.informacoes_empresa
  SET valor = val::text, atualizado_em = now()
  WHERE id = r.id;

  RETURN jsonb_build_object('success', true, 'settled', 1);
END $$;

REVOKE ALL ON FUNCTION public.settle_client_debts(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_client_debts(uuid, text) TO service_role;
