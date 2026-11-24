-- ==============================================================================
-- REMOVER TAXA AUTOMÁTICA DE CANCELAMENTO - TORNAR OPcional POR BARBEIRO
--
-- Esta migration cria os objetos de banco de dados ausentes e atualiza
-- cancelar_agendamento_cliente para respeitar a configuração do barbeiro
-- em vez de cobrar 20% automaticamente.
--
-- Pré-requisito: A migration 20261020040000 já deve estar aplicada
-- (cria cancellation_fee_amount, quote_client_cancellation, etc. com suporte a config)
-- ==============================================================================

-- 1. TABELA DIVIDAS
CREATE TABLE IF NOT EXISTS public.dividas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL,
  barbeiro_id uuid NOT NULL,
  agendamento_id uuid NOT NULL,
  valor_total numeric(10, 2) NOT NULL DEFAULT 0 CHECK (valor_total >= 0),
  valor_barbeiro numeric(10, 2) NOT NULL DEFAULT 0 CHECK (valor_barbeiro >= 0),
  valor_plataforma numeric(10, 2) NOT NULL DEFAULT 0 CHECK (valor_plataforma >= 0),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'cancelado')),
  pix_qr_code text,
  pix_id text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  pago_em timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dividas_cliente_status ON public.dividas(cliente_id, status);
CREATE INDEX IF NOT EXISTS idx_dividas_barbeiro_status ON public.dividas(barbeiro_id, status);
CREATE INDEX IF NOT EXISTS idx_dividas_agendamento ON public.dividas(agendamento_id);
CREATE INDEX IF NOT EXISTS idx_dividas_pix_id ON public.dividas(pix_id);

ALTER TABLE public.dividas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clientes visualizam suas proprias dividas" ON public.dividas;
CREATE POLICY "Clientes visualizam suas proprias dividas"
ON public.dividas FOR SELECT TO authenticated
USING (cliente_id = auth.uid());

DROP POLICY IF EXISTS "Barbeiros visualizam dividas de seus agendamentos" ON public.dividas;
CREATE POLICY "Barbeiros visualizam dividas de seus agendamentos"
ON public.dividas FOR SELECT TO authenticated
USING (barbeiro_id IN (SELECT id FROM public.barbeiros WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Service role tem acesso total a dividas" ON public.dividas;
CREATE POLICY "Service role tem acesso total a dividas"
ON public.dividas FOR ALL TO service_role
USING (true) WITH CHECK (true);

GRANT SELECT ON public.dividas TO authenticated;
GRANT ALL ON public.dividas TO service_role;

-- 2. COLUNA inicio_em EM agendamentos
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

UPDATE public.agendamentos
SET inicio_em = (data + hora) AT TIME ZONE 'America/Sao_Paulo'
WHERE inicio_em IS NULL AND data IS NOT NULL AND hora IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agendamentos_inicio_em ON public.agendamentos(inicio_em);

-- 3. TRIGGER DE BLOQUEIO POR DÍVIDA PENDENTE
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

-- 4. FUNÇÃO CANCELAR_AGENDAMENTO_CLIENTE (respeita config do barbeiro, sem taxa automática de 20%)
CREATE OR REPLACE FUNCTION public.cancelar_agendamento_cliente(p_agendamento_id uuid, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_apt public.agendamentos%ROWTYPE;
  v_servico public.servicos%ROWTYPE;
  v_preco_base numeric;
  v_valor_taxa numeric := 0;
  v_valor_barbeiro numeric := 0;
  v_valor_plataforma numeric := 0;
  v_dentro_janela boolean := false;
  v_divida_id uuid := NULL;
  v_inicio_em timestamptz;
  v_config jsonb := '{}';
  v_horas_antecedencia integer := 2;
  v_taxa_habilitada boolean := false;
BEGIN
  SELECT * INTO v_apt FROM public.agendamentos
  WHERE id = p_agendamento_id AND user_id = p_user_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'AGENDAMENTO_NAO_ENCONTRADO'; END IF;

  IF v_apt.status IN ('cancelled_by_user', 'cancelled_by_barber', 'completed') THEN
    RAISE EXCEPTION 'AGENDAMENTO_JA_FINALIZADO';
  END IF;

  SELECT * INTO v_servico FROM public.servicos WHERE id = v_apt.servico_id;

  v_inicio_em := COALESCE(v_apt.inicio_em, (v_apt.data + v_apt.hora) AT TIME ZONE 'America/Sao_Paulo');

  -- Buscar configuração de taxa do barbeiro (chave específica do barbeiro)
  SELECT valor::jsonb INTO v_config
  FROM public.informacoes_empresa
  WHERE chave = 'taxa_cancelamento_' || v_apt.barbeiro_id
    AND ativo = true
  ORDER BY id DESC LIMIT 1;

  -- Fallback: configuração geral da barbearia (tenant)
  IF v_config IS NULL OR v_config = '{}'::jsonb THEN
    SELECT valor::jsonb INTO v_config
    FROM public.informacoes_empresa
    WHERE chave = 'taxa_cancelamento'
      AND ativo = true
    ORDER BY id DESC LIMIT 1;
  END IF;

  v_taxa_habilitada := COALESCE((v_config->>'habilitado')::boolean, false);
  v_horas_antecedencia := COALESCE((v_config->>'horas_antecedencia')::integer, 2);

  -- Checar se está dentro da janela de antecedência configurada
  v_dentro_janela := now() > (v_inicio_em - (v_horas_antecedencia || ' hours')::interval);

  IF v_dentro_janela AND v_taxa_habilitada THEN
    v_preco_base := COALESCE(NULLIF(v_apt.preco, 0), v_servico.preco, 0);

    IF v_config->>'tipo' = 'fixo' THEN
      v_valor_taxa := COALESCE((v_config->>'valor')::numeric, 0);
    ELSE
      v_valor_taxa := round(v_preco_base * COALESCE((v_config->>'valor')::numeric, 20) / 100, 2);
    END IF;

    v_valor_barbeiro := round(v_valor_taxa * 0.50, 2);
    v_valor_plataforma := v_valor_taxa - v_valor_barbeiro;

    INSERT INTO public.dividas (
      cliente_id, barbeiro_id, agendamento_id, valor_total, valor_barbeiro, valor_plataforma, status, criado_em
    ) VALUES (
      p_user_id, v_apt.barbeiro_id, v_apt.id, v_valor_taxa, v_valor_barbeiro, v_valor_plataforma, 'pendente', now()
    ) RETURNING id INTO v_divida_id;

    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, agendamento_id, created_at)
    VALUES (
      p_user_id, 'taxa_cancelamento', 'Taxa de cancelamento registrada',
      'Você cancelou com menos de ' || v_horas_antecedencia || 'h de antecedência. Foi gerada uma pendência de R$ ' || to_char(v_valor_taxa, 'FM999G990D00') || '. Pague para continuar agendando.',
      v_apt.id, now()
    );
  END IF;

  UPDATE public.agendamentos
  SET status = 'cancelled_by_user', cancelado_em = now(), updated_at = now()
  WHERE id = v_apt.id;

  IF NOT v_dentro_janela OR NOT v_taxa_habilitada THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, agendamento_id, created_at)
    VALUES (
      p_user_id, 'cancelamento', 'Agendamento cancelado',
      'Seu agendamento foi cancelado gratuitamente.',
      v_apt.id, now()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'dentro_janela', v_dentro_janela,
    'taxa_aplicada', v_valor_taxa > 0,
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