
-- 1. TABLE ciclos_indicacao
CREATE TABLE public.ciclos_indicacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','apurado','cancelado')),
  vencedor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  quantidade_indicacoes_vencedor integer,
  apurado_em timestamptz,
  criado_por uuid REFERENCES public.profiles(id),
  tenant_id uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ciclos_indicacao_datas_ck CHECK (data_fim > data_inicio)
);

CREATE INDEX idx_ciclos_indicacao_status ON public.ciclos_indicacao(status);
CREATE INDEX idx_ciclos_indicacao_data_fim ON public.ciclos_indicacao(data_fim);

GRANT SELECT ON public.ciclos_indicacao TO authenticated;
GRANT ALL ON public.ciclos_indicacao TO service_role;

ALTER TABLE public.ciclos_indicacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver ciclos"
  ON public.ciclos_indicacao FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin cria ciclos"
  ON public.ciclos_indicacao FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'tenant_admin'::app_role)
    OR public.has_role(auth.uid(),'ti'::app_role)
  );

CREATE POLICY "Admin atualiza ciclos"
  ON public.ciclos_indicacao FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'tenant_admin'::app_role)
    OR public.has_role(auth.uid(),'ti'::app_role)
  );

-- 2. FUNCTION criar_ciclo_indicacao
CREATE OR REPLACE FUNCTION public.criar_ciclo_indicacao(p_data_inicio date, p_data_fim date)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'tenant_admin'::app_role)
    OR public.has_role(auth.uid(),'ti'::app_role)
  ) THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE='42501';
  END IF;

  IF p_data_fim <= p_data_inicio THEN
    RAISE EXCEPTION 'data_fim deve ser posterior a data_inicio';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ciclos_indicacao
    WHERE status = 'ativo'
      AND daterange(data_inicio, data_fim, '[]') && daterange(p_data_inicio, p_data_fim, '[]')
  ) THEN
    RAISE EXCEPTION 'Ja existe um ciclo ativo sobreposto ao intervalo informado';
  END IF;

  INSERT INTO public.ciclos_indicacao (data_inicio, data_fim, status, criado_por)
  VALUES (p_data_inicio, p_data_fim, 'ativo', auth.uid())
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 3. FUNCTION apurar_ciclo_indicacao
CREATE OR REPLACE FUNCTION public.apurar_ciclo_indicacao(p_ciclo_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ciclo record;
  v_max int;
  v_vencedor_id uuid;
  v_indicacao_vencedora uuid;
BEGIN
  SELECT * INTO v_ciclo FROM public.ciclos_indicacao WHERE id = p_ciclo_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ciclo nao encontrado'; END IF;
  IF v_ciclo.status <> 'ativo' THEN RAISE EXCEPTION 'Ciclo nao esta ativo (status=%)', v_ciclo.status; END IF;

  -- Contagem por indicador dentro do intervalo
  WITH ranked AS (
    SELECT
      i.indicador_id,
      i.id AS indicacao_id,
      i.liberado_em,
      row_number() OVER (PARTITION BY i.indicador_id ORDER BY i.liberado_em ASC) AS rn,
      count(*) OVER (PARTITION BY i.indicador_id) AS total
    FROM public.indicacoes i
    WHERE i.status = 'liberado'
      AND i.liberado_em IS NOT NULL
      AND i.liberado_em::date >= v_ciclo.data_inicio
      AND i.liberado_em::date <= v_ciclo.data_fim
  ),
  totais AS (
    SELECT indicador_id, max(total) AS total FROM ranked GROUP BY indicador_id
  )
  SELECT max(total) INTO v_max FROM totais;

  IF v_max IS NULL OR v_max = 0 THEN
    UPDATE public.ciclos_indicacao
       SET status='apurado', vencedor_id=NULL, quantidade_indicacoes_vencedor=0, apurado_em=now()
     WHERE id = p_ciclo_id;
    RETURN NULL;
  END IF;

  -- Desempate: quem atingiu v_max primeiro
  WITH ranked AS (
    SELECT
      i.indicador_id,
      i.id AS indicacao_id,
      i.liberado_em,
      row_number() OVER (PARTITION BY i.indicador_id ORDER BY i.liberado_em ASC) AS rn,
      count(*) OVER (PARTITION BY i.indicador_id) AS total
    FROM public.indicacoes i
    WHERE i.status = 'liberado'
      AND i.liberado_em IS NOT NULL
      AND i.liberado_em::date >= v_ciclo.data_inicio
      AND i.liberado_em::date <= v_ciclo.data_fim
  )
  SELECT indicador_id, indicacao_id
    INTO v_vencedor_id, v_indicacao_vencedora
    FROM ranked
   WHERE total = v_max AND rn = v_max
   ORDER BY liberado_em ASC
   LIMIT 1;

  INSERT INTO public.creditos_indicacao (user_id, indicacao_id, status)
  VALUES (v_vencedor_id, v_indicacao_vencedora, 'disponivel');

  UPDATE public.ciclos_indicacao
     SET status='apurado',
         vencedor_id=v_vencedor_id,
         quantidade_indicacoes_vencedor=v_max,
         apurado_em=now()
   WHERE id = p_ciclo_id;

  RETURN v_vencedor_id;
END;
$$;

-- 4. FUNCTION verificar_ciclos_para_apurar (para cron)
CREATE OR REPLACE FUNCTION public.verificar_ciclos_para_apurar()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ciclo record;
  v_count int := 0;
BEGIN
  FOR v_ciclo IN
    SELECT id FROM public.ciclos_indicacao
    WHERE status = 'ativo' AND data_fim <= (now() AT TIME ZONE 'America/Sao_Paulo')::date
  LOOP
    BEGIN
      PERFORM public.apurar_ciclo_indicacao(v_ciclo.id);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Falha ao apurar ciclo %: %', v_ciclo.id, SQLERRM;
    END;
  END LOOP;
  RETURN v_count;
END;
$$;

-- 5. AJUSTE do trigger existente: remove insercao de credito, mantem transicao para 'liberado'
CREATE OR REPLACE FUNCTION public.trg_indicacao_agendamento_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_indicacao_id uuid;
BEGIN
  IF NEW.status::text <> 'completed' OR OLD.status::text = 'completed' THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT id INTO v_indicacao_id
    FROM public.indicacoes
    WHERE agendamento_qualificador_id = NEW.id
      AND status = 'agendado'
    LIMIT 1;

    IF v_indicacao_id IS NULL THEN
      RETURN NEW;
    END IF;

    UPDATE public.indicacoes
       SET status = 'liberado',
           confirmado_em = COALESCE(confirmado_em, now()),
           liberado_em = now()
     WHERE id = v_indicacao_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Falha ao liberar indicacao para agendamento %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- 6. AGENDAMENTO pg_cron
DO $$
BEGIN
  PERFORM cron.unschedule('apurar-ciclos-indicacao-diario');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'apurar-ciclos-indicacao-diario',
  '5 3 * * *', -- 00:05 America/Sao_Paulo (UTC-3) = 03:05 UTC
  $$ SELECT public.verificar_ciclos_para_apurar(); $$
);
