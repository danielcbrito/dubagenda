-- ==============================================================================
-- SISTEMA DE TAXA DE CANCELAMENTO E COBRANÇA AUTOMÁTICA
-- 1. Nova tabela: dividas (id, cliente_id, barbeiro_id, agendamento_id, valor_total, valor_barbeiro, valor_plataforma, status, pix_qr_code, pix_id, criado_em, pago_em)
-- 2. Coluna inicio_em em agendamentos com cálculo automático (America/Sao_Paulo)
-- 3. Bloqueio automático de novos agendamentos para clientes com status 'pendente' em dividas
-- 4. Função cancelar_agendamento_cliente: checa regra de 2h (taxa de 20%: 50% barbeiro, 50% plataforma)
-- 5. Cron job de hora em hora: notificação 3h antes (Push no app + WhatsApp via Evolution API)
-- 6. Função quitar_divida: atualiza status para 'pago', libera cliente e notifica barbeiro
-- ==============================================================================

-- 1. TABELA DIVIDAS
CREATE TABLE IF NOT EXISTS public.dividas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  barbeiro_id uuid NOT NULL REFERENCES public.barbeiros(id) ON DELETE CASCADE,
  agendamento_id uuid NOT NULL REFERENCES public.agendamentos(id) ON DELETE CASCADE,
  valor_total numeric(10, 2) NOT NULL CHECK (valor_total >= 0),
  valor_barbeiro numeric(10, 2) NOT NULL CHECK (valor_barbeiro >= 0),
  valor_plataforma numeric(10, 2) NOT NULL CHECK (valor_plataforma >= 0),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'cancelado')),
  pix_qr_code text,
  pix_id text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  pago_em timestamptz
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_dividas_cliente_status ON public.dividas(cliente_id, status);
CREATE INDEX IF NOT EXISTS idx_dividas_barbeiro_status ON public.dividas(barbeiro_id, status);
CREATE INDEX IF NOT EXISTS idx_dividas_agendamento ON public.dividas(agendamento_id);
CREATE INDEX IF NOT EXISTS idx_dividas_pix_id ON public.dividas(pix_id);

-- RLS (Row Level Security)
ALTER TABLE public.dividas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clientes visualizam suas proprias dividas" ON public.dividas;
CREATE POLICY "Clientes visualizam suas proprias dividas"
ON public.dividas FOR SELECT
TO authenticated
USING (cliente_id = auth.uid());

DROP POLICY IF EXISTS "Barbeiros visualizam dividas de seus agendamentos" ON public.dividas;
CREATE POLICY "Barbeiros visualizam dividas de seus agendamentos"
ON public.dividas FOR SELECT
TO authenticated
USING (
  barbeiro_id IN (SELECT id FROM public.barbeiros WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Service role tem acesso total a dividas" ON public.dividas;
CREATE POLICY "Service role tem acesso total a dividas"
ON public.dividas FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

GRANT SELECT ON public.dividas TO authenticated;
GRANT ALL ON public.dividas TO service_role;

-- 2. COLUNA inicio_em EM agendamentos COM MANUTENÇÃO AUTOMÁTICA
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS inicio_em timestamptz;

CREATE OR REPLACE FUNCTION public.set_agendamento_inicio_em()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.data IS NOT NULL AND NEW.hora IS NOT NULL THEN
    NEW.inicio_em := (NEW.data + NEW.hora) AT TIME ZONE 'America/Sao_Paulo';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_agendamento_inicio_em ON public.agendamentos;
CREATE TRIGGER trg_set_agendamento_inicio_em
BEFORE INSERT OR UPDATE OF data, hora ON public.agendamentos
FOR EACH ROW EXECUTE FUNCTION public.set_agendamento_inicio_em();

-- Preencher agendamentos existentes
UPDATE public.agendamentos
SET inicio_em = (data + hora) AT TIME ZONE 'America/Sao_Paulo'
WHERE inicio_em IS NULL AND data IS NOT NULL AND hora IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agendamentos_inicio_em ON public.agendamentos(inicio_em);
CREATE INDEX IF NOT EXISTS idx_agendamentos_status_inicio_em ON public.agendamentos(status, inicio_em);

-- 3. TRIGGER DE BLOQUEIO DE NOVOS AGENDAMENTOS SE HOUVER DÍVIDA PENDENTE
CREATE OR REPLACE FUNCTION public.check_cliente_bloqueado_por_divida()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.dividas
      WHERE cliente_id = NEW.user_id AND status = 'pendente'
    ) THEN
      RAISE EXCEPTION 'CLIENTE_POSSUI_PENDENCIA: Você tem uma pendência de cancelamento. Pague para continuar agendando.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_divida_agendamento ON public.agendamentos;
CREATE TRIGGER trg_check_divida_agendamento
BEFORE INSERT ON public.agendamentos
FOR EACH ROW EXECUTE FUNCTION public.check_cliente_bloqueado_por_divida();

DROP TRIGGER IF EXISTS trg_check_divida_pending_bookings ON public.pending_bookings;
CREATE TRIGGER trg_check_divida_pending_bookings
BEFORE INSERT ON public.pending_bookings
FOR EACH ROW EXECUTE FUNCTION public.check_cliente_bloqueado_por_divida();

-- 4. FUNÇÃO DE CANCELAMENTO COM REGRA DE 2 HORAS E TAXA DE 20% (SPLIT 50/50)
CREATE OR REPLACE FUNCTION public.cancelar_agendamento_cliente(p_agendamento_id uuid, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_apt public.agendamentos%ROWTYPE;
  v_servico public.servicos%ROWTYPE;
  v_barbeiro public.barbeiros%ROWTYPE;
  v_preco_base numeric;
  v_valor_taxa numeric;
  v_valor_barbeiro numeric;
  v_valor_plataforma numeric;
  v_dentro_2h boolean;
  v_divida_id uuid := NULL;
  v_inicio_em timestamptz;
BEGIN
  SELECT * INTO v_apt FROM public.agendamentos
  WHERE id = p_agendamento_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AGENDAMENTO_NAO_ENCONTRADO';
  END IF;

  IF v_apt.status IN ('cancelled_by_user', 'cancelled_by_barber', 'completed') THEN
    RAISE EXCEPTION 'AGENDAMENTO_JA_FINALIZADO';
  END IF;

  SELECT * INTO v_servico FROM public.servicos WHERE id = v_apt.servico_id;
  SELECT * INTO v_barbeiro FROM public.barbeiros WHERE id = v_apt.barbeiro_id;

  v_inicio_em := COALESCE(v_apt.inicio_em, (v_apt.data + v_apt.hora) AT TIME ZONE 'America/Sao_Paulo');

  -- Checar se está dentro de 2 horas antes do agendamento (now() > inicio_em - interval '2 hours')
  v_dentro_2h := now() > (v_inicio_em - interval '2 hours');

  IF v_dentro_2h THEN
    -- Preço base do serviço
    v_preco_base := COALESCE(NULLIF(v_apt.preco, 0), v_servico.preco, 0);
    
    -- Taxa = 20% do serviço agendado
    v_valor_taxa := round(v_preco_base * 0.20, 2);
    
    -- Split: 50% pro barbeiro afetado, 50% pra plataforma
    v_valor_barbeiro := round(v_valor_taxa * 0.50, 2);
    v_valor_plataforma := v_valor_taxa - v_valor_barbeiro;

    -- Criar registro na tabela dividas com status pendente
    INSERT INTO public.dividas (
      cliente_id,
      barbeiro_id,
      agendamento_id,
      valor_total,
      valor_barbeiro,
      valor_plataforma,
      status,
      criado_em
    ) VALUES (
      p_user_id,
      v_apt.barbeiro_id,
      v_apt.id,
      v_valor_taxa,
      v_valor_barbeiro,
      v_valor_plataforma,
      'pendente',
      now()
    ) RETURNING id INTO v_divida_id;

    -- Notificação informativa para o cliente no app
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, agendamento_id, created_at)
    VALUES (
      p_user_id,
      'taxa_cancelamento',
      'Taxa de cancelamento registrada',
      'Você cancelou com menos de 2h de antecedência. Foi gerada uma pendência de R$ ' || to_char(v_valor_taxa, 'FM999G990D00') || '. Pague para continuar agendando.',
      v_apt.id,
      now()
    );
  END IF;

  -- Atualizar agendamento para cancelado pelo usuário
  UPDATE public.agendamentos
  SET status = 'cancelled_by_user',
      cancelado_em = now(),
      updated_at = now()
  WHERE id = v_apt.id;

  -- Notificação informativa se foi cancelamento gratuito
  IF NOT v_dentro_2h THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, agendamento_id, created_at)
    VALUES (
      p_user_id,
      'cancelamento',
      'Agendamento cancelado',
      'Seu agendamento foi cancelado gratuitamente com mais de 2 horas de antecedência.',
      v_apt.id,
      now()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'dentro_2h', v_dentro_2h,
    'taxa_aplicada', v_dentro_2h,
    'valor_taxa', COALESCE(v_valor_taxa, 0),
    'valor_barbeiro', COALESCE(v_valor_barbeiro, 0),
    'valor_plataforma', COALESCE(v_valor_plataforma, 0),
    'divida_id', v_divida_id,
    'agendamento_id', v_apt.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancelar_agendamento_cliente(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_agendamento_cliente(uuid, uuid) TO authenticated, service_role;

-- 5. CRON JOB: NOTIFICAÇÃO 3H ANTES (PUSH NO APP + WHATSAPP VIA EVOLUTION API)
CREATE OR REPLACE FUNCTION public.processar_lembretes_3h_antes()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rec RECORD;
  v_count integer := 0;
  v_msg text;
  v_hora text;
  v_cli_nome text;
BEGIN
  -- Janela: inicio_em entre agora+3h e agora+3h+1h (agora+4h)
  FOR v_rec IN
    SELECT 
      a.id,
      a.user_id,
      a.data,
      a.hora,
      a.barbeiro_id,
      a.servico_id,
      p.nome AS cliente_nome,
      p.telefone AS cliente_telefone,
      b.apelido AS barbeiro_nome,
      s.nome AS servico_nome
    FROM public.agendamentos a
    JOIN public.profiles p ON p.id = a.user_id
    JOIN public.barbeiros b ON b.id = a.barbeiro_id
    JOIN public.servicos s ON s.id = a.servico_id
    WHERE a.status IN ('pending', 'confirmed')
      AND a.visivel_para_usuario = true
      AND a.inicio_em >= (now() + interval '3 hours')
      AND a.inicio_em < (now() + interval '4 hours')
      -- Evitar reenvio para o mesmo agendamento
      AND NOT EXISTS (
        SELECT 1 FROM public.notificacoes n
        WHERE n.agendamento_id = a.id AND n.tipo = 'lembrete_3h'
      )
  LOOP
    v_hora := substring(v_rec.hora::text from 1 for 5);
    v_cli_nome := split_part(COALESCE(v_rec.cliente_nome, 'Cliente'), ' ', 1);
    
    v_msg := 'Olá ' || v_cli_nome || '! Seu horário de ' || v_rec.servico_nome || 
             ' com ' || v_rec.barbeiro_nome || ' é daqui a 3 horas, às ' || v_hora || 
             '. Lembramos que cancelamentos com menos de 2h de antecedência possuem taxa. Te esperamos! 💈';

    -- 1. Notificação Push no App do Cliente
    INSERT INTO public.notificacoes (
      user_id,
      tipo,
      titulo,
      mensagem,
      agendamento_id,
      created_at,
      lida
    ) VALUES (
      v_rec.user_id,
      'lembrete_3h',
      'Seu horário é daqui a 3 horas (' || v_hora || ')',
      v_msg,
      v_rec.id,
      now(),
      false
    );

    -- 2. Mensagem WhatsApp via Evolution API / Webhook
    BEGIN
      PERFORM public.send_agendamento_whatsapp_webhook(
        v_rec.id,
        'lembrete_3h',
        v_msg
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Erro ao enviar WhatsApp lembrete_3h para agendamento %: %', v_rec.id, SQLERRM;
    END;

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'lembretes_enviados', v_count, 'executado_em', now());
END;
$$;

REVOKE ALL ON FUNCTION public.processar_lembretes_3h_antes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.processar_lembretes_3h_antes() TO authenticated, service_role;

-- Agendamento no pg_cron (roda de hora em hora)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('lembrete-agendamento-3h');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    PERFORM cron.schedule(
      'lembrete-agendamento-3h',
      '0 * * * *',
      $$ SELECT public.processar_lembretes_3h_antes(); $$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 6. FUNÇÃO DE QUITAÇÃO DA DÍVIDA (CONFIRMAÇÃO DO WEBHOOK WOOVI)
CREATE OR REPLACE FUNCTION public.quitar_divida(p_divida_id uuid, p_pix_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_divida public.dividas%ROWTYPE;
  v_barbeiro public.barbeiros%ROWTYPE;
  v_cliente public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_divida FROM public.dividas WHERE id = p_divida_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'DIVIDA_NAO_ENCONTRADA');
  END IF;

  IF v_divida.status = 'pago' THEN
    RETURN jsonb_build_object('success', true, 'already_paid', true);
  END IF;

  SELECT * INTO v_barbeiro FROM public.barbeiros WHERE id = v_divida.barbeiro_id;
  SELECT * INTO v_cliente FROM public.profiles WHERE id = v_divida.cliente_id;

  UPDATE public.dividas
  SET status = 'pago',
      pago_em = now(),
      pix_id = COALESCE(p_pix_id, pix_id)
  WHERE id = v_divida.id;

  -- 1. Notificar Barbeiro que recebeu a parte dele (50% da taxa)
  IF v_barbeiro.user_id IS NOT NULL THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, agendamento_id, created_at)
    VALUES (
      v_barbeiro.user_id,
      'taxa_recebida',
      'Taxa de cancelamento recebida',
      'Você recebeu R$ ' || to_char(v_divida.valor_barbeiro, 'FM999G990D00') || ' referente à taxa de cancelamento de ' || COALESCE(v_cliente.nome, 'Cliente') || '.',
      v_divida.agendamento_id,
      now()
    );
  END IF;

  -- 2. Notificar Cliente que a dívida foi quitada e está liberado para agendar novamente
  INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, agendamento_id, created_at)
  VALUES (
    v_divida.cliente_id,
    'divida_paga',
    'Taxa de cancelamento quitada',
    'Seu pagamento de R$ ' || to_char(v_divida.valor_total, 'FM999G990D00') || ' foi confirmado com sucesso. Você já pode realizar novos agendamentos!',
    v_divida.agendamento_id,
    now()
  );

  RETURN jsonb_build_object('success', true, 'status', 'pago', 'divida_id', v_divida.id);
END;
$$;

REVOKE ALL ON FUNCTION public.quitar_divida(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quitar_divida(uuid, text) TO service_role, authenticated;

-- 7. CONSULTA OTIMIZADA DE DÍVIDAS DO CLIENTE AUTENTICADO
CREATE OR REPLACE FUNCTION public.consultar_minhas_dividas()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'cliente_id', d.cliente_id,
        'barbeiro_id', d.barbeiro_id,
        'barbeiro_nome', COALESCE(b.apelido, 'Barbeiro'),
        'agendamento_id', d.agendamento_id,
        'agendamento_data', a.data,
        'agendamento_hora', a.hora,
        'servico_nome', COALESCE(s.nome, 'Serviço'),
        'valor_total', d.valor_total,
        'valor_barbeiro', d.valor_barbeiro,
        'valor_plataforma', d.valor_plataforma,
        'status', d.status,
        'pix_qr_code', d.pix_qr_code,
        'pix_id', d.pix_id,
        'criado_em', d.criado_em,
        'pago_em', d.pago_em
      ) ORDER BY d.criado_em DESC
    ),
    '[]'::jsonb
  )
  FROM public.dividas d
  LEFT JOIN public.agendamentos a ON a.id = d.agendamento_id
  LEFT JOIN public.barbeiros b ON b.id = d.barbeiro_id
  LEFT JOIN public.servicos s ON s.id = a.servico_id
  WHERE d.cliente_id = auth.uid()
    AND d.status = 'pendente';
$$;

REVOKE ALL ON FUNCTION public.consultar_minhas_dividas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consultar_minhas_dividas() TO authenticated;
