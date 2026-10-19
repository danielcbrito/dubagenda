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
