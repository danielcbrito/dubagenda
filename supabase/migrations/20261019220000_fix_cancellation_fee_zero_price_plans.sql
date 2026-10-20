-- Migration: Corrigir taxa de cancelamento e bloqueio para agendamentos com preço zero (Planos VIP, cortesias e resgates)
-- Quando o agendamento é feito via plano, preco é gravado como 0. A taxa deve incidir sobre o preço de tabela do serviço.

CREATE OR REPLACE FUNCTION public.quote_client_cancellation(p_appointment uuid, p_user uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  a public.agendamentos%ROWTYPE;
  t uuid;
  c jsonb := '{}';
  n integer;
  fee numeric;
  base_price numeric;
BEGIN
  SELECT * INTO a FROM public.agendamentos WHERE id = p_appointment AND user_id = p_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'APPOINTMENT_NOT_OWNED'; END IF;

  SELECT tenant_id INTO t FROM public.barbeiros WHERE id = a.barbeiro_id;
  IF t IS NULL THEN RAISE EXCEPTION 'TENANT_REQUIRED'; END IF;

  SELECT count(*) INTO n FROM public.informacoes_empresa WHERE tenant_id = t AND chave = 'taxa_cancelamento_' || a.barbeiro_id AND ativo = true;
  IF n > 1 THEN RAISE EXCEPTION 'DUPLICATE_CANCELLATION_CONFIG'; END IF;

  SELECT valor::jsonb INTO c FROM public.informacoes_empresa WHERE tenant_id = t AND chave = 'taxa_cancelamento_' || a.barbeiro_id AND ativo = true;

  -- Obter preço base para cálculo da taxa: se o agendamento teve preco <= 0 (como em assinaturas de plano, cortesias ou resgate de fidelidade),
  -- busca o preço original do serviço cadastrado em public.servicos.
  SELECT COALESCE(NULLIF(a.preco, 0), s.preco, 0)
  INTO base_price
  FROM public.servicos s
  WHERE s.id = a.servico_id;

  IF base_price IS NULL OR base_price <= 0 THEN
    base_price := COALESCE(a.preco, 0);
  END IF;

  fee := public.cancellation_fee_amount(COALESCE(c, '{}'), base_price, (a.data + a.hora) AT TIME ZONE 'America/Sao_Paulo', now());

  RETURN jsonb_build_object(
    'valor_taxa', fee,
    'config', COALESCE(c, '{}'),
    'tenant_id', t,
    'valor_servico_original', base_price
  );
END $$;

REVOKE ALL ON FUNCTION public.quote_client_cancellation(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quote_client_cancellation(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.record_client_cancellation_debt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  q jsonb;
  fee numeric;
  existing public.informacoes_empresa%ROWTYPE;
  debt jsonb;
  t uuid;
  client_name text;
  client_phone text;
  orig_price numeric;
BEGIN
  IF NEW.status <> 'cancelled_by_user' OR OLD.status NOT IN ('pending', 'confirmed') OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('cancel-debt:' || NEW.user_id::text, 0));

  q := public.quote_client_cancellation(NEW.id, NEW.user_id);
  fee := (q->>'valor_taxa')::numeric;
  t := (q->>'tenant_id')::uuid;

  IF fee <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT * INTO existing FROM public.informacoes_empresa
  WHERE tenant_id = t AND categoria = 'debitos_cliente' AND chave = 'debito_cancelamento_' || NEW.user_id
  FOR UPDATE;

  IF existing.id IS NOT NULL AND existing.valor::jsonb->>'status' = 'pendente' THEN
    RAISE EXCEPTION 'PENDING_CANCELLATION_DEBT';
  END IF;

  SELECT nome, telefone INTO client_name, client_phone FROM public.profiles WHERE id = NEW.user_id;

  orig_price := COALESCE(NULLIF((q->>'valor_servico_original')::numeric, 0), NEW.preco, 0);

  debt := jsonb_build_object(
    'id', gen_random_uuid(),
    'cliente_id', NEW.user_id,
    'cliente_nome', COALESCE(client_name, ''),
    'cliente_telefone', COALESCE(client_phone, ''),
    'barbeiro_id', NEW.barbeiro_id,
    'agendamento_id', NEW.id,
    'valor_taxa', fee,
    'tipo_taxa', COALESCE(q->'config'->>'tipo', 'porcentagem'),
    'porcentagem_aplicada', CASE WHEN COALESCE(q->'config'->>'tipo', 'porcentagem') = 'porcentagem' THEN COALESCE((q->'config'->>'valor')::numeric, 20) ELSE NULL END,
    'valor_servico_original', orig_price,
    'status', 'pendente',
    'created_at', now(),
    'tenant_id', t
  );

  IF existing.id IS NULL THEN
    INSERT INTO public.informacoes_empresa(tenant_id, chave, categoria, valor, ativo)
    VALUES(t, 'debito_cancelamento_' || NEW.user_id, 'debitos_cliente', debt::text, true);
  ELSE
    UPDATE public.informacoes_empresa
    SET valor = debt::text, ativo = true, atualizado_em = now()
    WHERE id = existing.id;
  END IF;

  RETURN NEW;
END $function$;

REVOKE ALL ON FUNCTION public.record_client_cancellation_debt() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_client_cancellation_debt() TO service_role;

-- Garantir que Barbeiro VIP tenha chave PIX configurada para viabilizar quitação PIX caso ocorra taxa
UPDATE public.barbeiros
SET woovi_pix_key = '57449344807'
WHERE id = '1cf7a87c-d4a4-4a63-8e2c-75a2cb5fb770' AND woovi_pix_key IS NULL;
