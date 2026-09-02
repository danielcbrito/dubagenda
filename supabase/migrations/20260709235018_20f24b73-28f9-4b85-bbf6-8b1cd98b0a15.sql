
-- 1. Expandir status para incluir 'link_clicked'
ALTER TABLE public.indicacoes DROP CONSTRAINT indicacoes_status_check;
ALTER TABLE public.indicacoes ADD CONSTRAINT indicacoes_status_check
  CHECK (status = ANY (ARRAY['link_clicked','pendente','agendado','confirmado','liberado','invalidado','expirado']));

-- 2. Permitir indicado_id NULL (para cliques ainda não convertidos)
ALTER TABLE public.indicacoes ALTER COLUMN indicado_id DROP NOT NULL;
ALTER TABLE public.indicacoes DROP CONSTRAINT indicacoes_no_self;
ALTER TABLE public.indicacoes ADD CONSTRAINT indicacoes_no_self
  CHECK (indicado_id IS NULL OR indicador_id <> indicado_id);

-- 3. Session id do clique + timestamp
ALTER TABLE public.indicacoes ADD COLUMN IF NOT EXISTS click_session_id text;
ALTER TABLE public.indicacoes ADD COLUMN IF NOT EXISTS link_clicked_em timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS indicacoes_click_session_unique
  ON public.indicacoes (indicador_id, click_session_id)
  WHERE click_session_id IS NOT NULL AND indicado_id IS NULL;

-- 4. Realtime
ALTER TABLE public.indicacoes REPLICA IDENTITY FULL;

-- 5. RPC pública para registrar clique (sem auth)
CREATE OR REPLACE FUNCTION public.registrar_click_indicacao(p_codigo text, p_session_id text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_indicador_id uuid;
  v_id uuid;
BEGIN
  IF p_codigo IS NULL OR length(trim(p_codigo)) = 0 THEN RETURN NULL; END IF;
  IF p_session_id IS NULL OR length(trim(p_session_id)) < 8 THEN RETURN NULL; END IF;

  SELECT id INTO v_indicador_id FROM public.profiles WHERE referral_code = upper(trim(p_codigo));
  IF v_indicador_id IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.indicacoes (indicador_id, indicado_id, codigo_usado, status, click_session_id, link_clicked_em)
  VALUES (v_indicador_id, NULL, upper(trim(p_codigo)), 'link_clicked', p_session_id, now())
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_click_indicacao(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.registrar_click_indicacao(text, text) TO anon, authenticated;

-- 6. Atualizar registrar_indicacao: limite 4 + promover link_clicked
CREATE OR REPLACE FUNCTION public.registrar_indicacao(p_indicado_id uuid, p_codigo text, p_session_id text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_indicador_id uuid;
  v_indicacao_id uuid;
  v_count int;
  v_duplicada boolean;
  LIMITE_MENSAL constant int := 4;
BEGIN
  IF p_codigo IS NULL OR length(trim(p_codigo)) = 0 THEN RETURN NULL; END IF;

  SELECT id INTO v_indicador_id FROM public.profiles WHERE referral_code = upper(trim(p_codigo));
  IF v_indicador_id IS NULL THEN RETURN NULL; END IF;

  IF v_indicador_id = p_indicado_id THEN RETURN NULL; END IF;

  IF EXISTS (SELECT 1 FROM public.indicacoes WHERE indicado_id = p_indicado_id) THEN
    RETURN NULL;
  END IF;

  v_duplicada := public.validar_identidade_duplicada(p_indicado_id);

  IF v_duplicada THEN
    INSERT INTO public.indicacoes (indicador_id, indicado_id, codigo_usado, status, motivo_invalidacao)
    VALUES (v_indicador_id, p_indicado_id, upper(trim(p_codigo)), 'invalidado',
            'Identidade (CPF/telefone/email) ja utilizada em outra conta')
    RETURNING id INTO v_indicacao_id;
    RETURN v_indicacao_id;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.indicacoes
  WHERE indicador_id = v_indicador_id
    AND indicado_id IS NOT NULL
    AND status <> 'invalidado'
    AND criado_em > now() - interval '30 days';

  IF v_count >= LIMITE_MENSAL THEN
    INSERT INTO public.indicacoes (indicador_id, indicado_id, codigo_usado, status, motivo_invalidacao)
    VALUES (v_indicador_id, p_indicado_id, upper(trim(p_codigo)), 'invalidado',
            'Limite mensal de indicacoes atingido')
    RETURNING id INTO v_indicacao_id;
    RETURN v_indicacao_id;
  END IF;

  -- Se houver clique registrado com esse session_id, promove
  IF p_session_id IS NOT NULL THEN
    UPDATE public.indicacoes
    SET indicado_id = p_indicado_id,
        status = 'pendente',
        criado_em = now()
    WHERE indicador_id = v_indicador_id
      AND click_session_id = p_session_id
      AND indicado_id IS NULL
    RETURNING id INTO v_indicacao_id;
  END IF;

  IF v_indicacao_id IS NULL THEN
    INSERT INTO public.indicacoes (indicador_id, indicado_id, codigo_usado, status)
    VALUES (v_indicador_id, p_indicado_id, upper(trim(p_codigo)), 'pendente')
    RETURNING id INTO v_indicacao_id;
  END IF;

  UPDATE public.profiles SET referred_by = v_indicador_id WHERE id = p_indicado_id;

  RETURN v_indicacao_id;
EXCEPTION WHEN unique_violation THEN
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_indicacao(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.registrar_indicacao(uuid, text, text) TO authenticated;

-- 7. Política SELECT para o indicador ver seus cliques (indicado_id IS NULL)
DROP POLICY IF EXISTS "Cliente ve suas indicacoes" ON public.indicacoes;
CREATE POLICY "Cliente ve suas indicacoes"
  ON public.indicacoes FOR SELECT TO authenticated
  USING (indicador_id = auth.uid() OR indicado_id = auth.uid());
