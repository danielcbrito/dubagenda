
-- 1) Remove o job duplicado
SELECT cron.unschedule(12);

-- 2) Remove a função redundante que não gerava crédito
DROP FUNCTION IF EXISTS public.apurar_ciclos_vencidos();

-- 3) Porta a renovação automática de ciclos fixos para dentro de apurar_ciclo_indicacao
CREATE OR REPLACE FUNCTION public.apurar_ciclo_indicacao(p_ciclo_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ciclo record;
  v_max int;
  v_vencedor_id uuid;
  v_indicacao_vencedora uuid;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_ref date;
  v_last int;
  v_di int;
  v_df int;
  v_novo_inicio date;
  v_novo_fim date;
BEGIN
  SELECT * INTO v_ciclo FROM public.ciclos_indicacao WHERE id = p_ciclo_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ciclo nao encontrado'; END IF;
  IF v_ciclo.status <> 'ativo' THEN RAISE EXCEPTION 'Ciclo nao esta ativo (status=%)', v_ciclo.status; END IF;

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
  ELSE
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
  END IF;

  -- Renovação automática para ciclos fixos (portada do antigo apurar_ciclos_vencidos)
  IF v_ciclo.tipo = 'fixo' AND v_ciclo.dia_inicio_mes IS NOT NULL AND v_ciclo.dia_fim_mes IS NOT NULL THEN
    v_ref := date_trunc('month', v_hoje)::date;
    v_last := EXTRACT(day FROM (v_ref + INTERVAL '1 month - 1 day'))::int;
    v_di := LEAST(v_ciclo.dia_inicio_mes, v_last);
    v_df := LEAST(v_ciclo.dia_fim_mes, v_last);
    v_novo_inicio := v_ref + (v_di - 1);
    v_novo_fim := v_ref + (v_df - 1);

    IF v_novo_fim < v_hoje THEN
      v_ref := (v_ref + INTERVAL '1 month')::date;
      v_last := EXTRACT(day FROM (v_ref + INTERVAL '1 month - 1 day'))::int;
      v_di := LEAST(v_ciclo.dia_inicio_mes, v_last);
      v_df := LEAST(v_ciclo.dia_fim_mes, v_last);
      v_novo_inicio := v_ref + (v_di - 1);
      v_novo_fim := v_ref + (v_df - 1);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.ciclos_indicacao
      WHERE status='ativo'
        AND daterange(data_inicio, data_fim, '[]') && daterange(v_novo_inicio, v_novo_fim, '[]')
    ) THEN
      INSERT INTO public.ciclos_indicacao (
        data_inicio, data_fim, status, criado_por,
        tipo, dia_inicio_mes, dia_fim_mes, ciclo_pai_id
      ) VALUES (
        v_novo_inicio, v_novo_fim, 'ativo', v_ciclo.criado_por,
        'fixo', v_ciclo.dia_inicio_mes, v_ciclo.dia_fim_mes, v_ciclo.id
      );
    END IF;
  END IF;

  RETURN v_vencedor_id;
END;
$function$;
