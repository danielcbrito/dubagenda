-- Script para criação e conferência da conta vinculada à Barbearia VIP Exclusive
-- Executável diretamente no Editor SQL do Supabase ou via migrations

DO $$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid := '5e825363-70ff-4abe-9143-9e87758437e7'::uuid; -- Barbearia VIP Exclusive
  v_unidade_id uuid := '6bf86df1-aa25-4cef-ab4c-2763897846c5'::uuid; -- Unidade Sede VIP Exclusive
  v_barbeiro_id uuid := '1cf7a87c-d4a4-4a63-8e2c-75a2cb5fb770'::uuid; -- Barbeiro VIP
  v_plano_id uuid := 'ce9b4790-8dda-4ae4-89fc-91147a104c08'::uuid; -- Plano VIP Teste
  v_email text := 'cliente.vip@dubagenda.com';
  v_nome text := 'Cliente VIP Exclusive';
  v_telefone text := '11999998888';
  v_encrypted_pw text;
BEGIN
  -- 1. Obter ou criar usuário em auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(v_email) LIMIT 1;

  IF v_user_id IS NULL THEN
    v_user_id := '661836a7-a45e-4255-9b37-ec137225a706'::uuid;
    v_encrypted_pw := extensions.crypt('VipExclusive2026!', extensions.gen_salt('bf'));

    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      lower(v_email),
      v_encrypted_pw,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'nome', v_nome,
        'telefone', v_telefone,
        'signup_origin', 'discover'
      ),
      now(),
      now()
    );

    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', lower(v_email)),
      'email',
      v_user_id::text,
      now(),
      now(),
      now()
    ) ON CONFLICT (provider, provider_id) DO NOTHING;
  ELSE
    -- Confirma o email imediatamente para permitir login com senha
    UPDATE auth.users
    SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = v_user_id;
  END IF;

  -- 2. Garantir role de cliente
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'cliente')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- 3. Configurar perfil vinculado diretamente à Barbearia VIP Exclusive
  INSERT INTO public.profiles (
    id,
    nome,
    telefone,
    barbearia_preferida_id,
    unidade_preferida_id,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    v_nome,
    v_telefone,
    v_tenant_id,
    v_unidade_id,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    nome = EXCLUDED.nome,
    telefone = EXCLUDED.telefone,
    barbearia_preferida_id = v_tenant_id,
    unidade_preferida_id = v_unidade_id,
    updated_at = now();

  -- 4. Criar ou renovar assinatura ativa do Plano VIP
  DELETE FROM public.assinaturas
  WHERE user_id = v_user_id
    AND plano_id <> v_plano_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.assinaturas
    WHERE user_id = v_user_id AND plano_id = v_plano_id
  ) THEN
    INSERT INTO public.assinaturas (
      user_id,
      plano_id,
      barbeiro_id,
      status,
      payment_method,
      cash_payment_confirmed,
      ciclo_inicio,
      ciclo_fim,
      next_billing_date,
      usos_ciclo_atual,
      total_renovacoes,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      v_plano_id,
      v_barbeiro_id,
      'active',
      'card',
      true,
      CURRENT_DATE,
      (CURRENT_DATE + interval '30 days')::date,
      (CURRENT_DATE + interval '30 days')::date,
      0,
      1,
      now(),
      now()
    );
  ELSE
    UPDATE public.assinaturas
    SET
      status = 'active',
      barbeiro_id = v_barbeiro_id,
      payment_method = 'card',
      cash_payment_confirmed = true,
      ciclo_inicio = CURRENT_DATE,
      ciclo_fim = (CURRENT_DATE + interval '30 days')::date,
      next_billing_date = (CURRENT_DATE + interval '30 days')::date,
      usos_ciclo_atual = 0,
      updated_at = now()
    WHERE user_id = v_user_id AND plano_id = v_plano_id;
  END IF;

END $$;

-- Conferência dos dados criados:
SELECT
  u.id AS user_id,
  u.email,
  u.email_confirmed_at,
  p.nome AS cliente_nome,
  p.telefone AS cliente_telefone,
  t.nome AS barbearia_vinculada,
  pl.nome AS plano_assinado,
  a.status AS assinatura_status,
  a.ciclo_inicio,
  a.ciclo_fim,
  b.apelido AS barbeiro_responsavel
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.tenants t ON t.id = p.barbearia_preferida_id
LEFT JOIN public.assinaturas a ON a.user_id = u.id AND a.status = 'active'
LEFT JOIN public.planos pl ON pl.id = a.plano_id
LEFT JOIN public.barbeiros b ON b.id = a.barbeiro_id
WHERE lower(u.email) = lower('cliente.vip@dubagenda.com');

-- 5. TRIGGER DE RESTRIÇÃO: Garantir que agendamentos com plano na Barbearia VIP Exclusive sejam SEMPRE de terça a quinta-feira
CREATE OR REPLACE FUNCTION public.enforce_plano_allowed_weekdays()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_dow int;
BEGIN
  IF NEW.tipo_agendamento = 'plano' OR COALESCE(NEW.payment_method, '') = 'plano' THEN
    SELECT tenant_id INTO v_tenant_id FROM public.barbeiros WHERE id = NEW.barbeiro_id;
    IF v_tenant_id IS NULL THEN
      SELECT barbearia_preferida_id INTO v_tenant_id FROM public.profiles WHERE id = NEW.user_id;
    END IF;

    IF v_tenant_id = '5e825363-70ff-4abe-9143-9e87758437e7'::uuid THEN
      v_dow := EXTRACT(DOW FROM NEW.data)::int;
      -- 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb
      IF v_dow NOT IN (2, 3, 4) THEN
        RAISE EXCEPTION 'Agendamentos com plano na Barbearia VIP são permitidos exclusivamente às terças, quartas e quintas-feiras.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_plano_allowed_weekdays ON public.agendamentos;
CREATE TRIGGER trg_enforce_plano_allowed_weekdays
BEFORE INSERT OR UPDATE OF data, tipo_agendamento, payment_method ON public.agendamentos
FOR EACH ROW
EXECUTE FUNCTION public.enforce_plano_allowed_weekdays();

-- 6. CORREÇÃO DA TAXA DE CANCELAMENTO E BLOQUEIO PARA PLANOS / AGENDAMENTOS COM PREÇO ZERO
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

UPDATE public.barbeiros
SET woovi_pix_key = '57449344807'
WHERE id = '1cf7a87c-d4a4-4a63-8e2c-75a2cb5fb770' AND woovi_pix_key IS NULL;


