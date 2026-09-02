
CREATE OR REPLACE FUNCTION public.get_next_available_date(
  p_barbeiro_id UUID,
  p_data_inicio DATE,
  p_dias_limite INT DEFAULT 45
)
RETURNS DATE
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_data DATE := p_data_inicio + 1;
  v_data_fim DATE := p_data_inicio + p_dias_limite;
  v_dia_semana INT;
  v_config RECORD;
  v_excecao RECORD;
  v_hora_abertura TIME;
  v_hora_fechamento TIME;
  v_hora_almoco_inicio TIME;
  v_hora_almoco_fim TIME;
  v_delay INT;
  v_minutos_disponiveis INT;
  v_max_slots INT;
  v_appointments_count INT;
  v_duracao_min INT := 30;
  v_today DATE := CURRENT_DATE;
BEGIN
  IF v_data < v_today THEN
    v_data := v_today;
  END IF;

  WHILE v_data <= v_data_fim LOOP
    v_dia_semana := EXTRACT(DOW FROM v_data)::INT;

    SELECT aberto, hora_abertura, hora_fechamento, hora_almoco_inicio, hora_almoco_fim
    INTO v_excecao
    FROM horarios_excepcionais_barbeiro
    WHERE barbeiro_id = p_barbeiro_id
      AND data = v_data::TEXT
    LIMIT 1;

    IF FOUND THEN
      IF COALESCE(v_excecao.aberto, false) = false THEN
        v_data := v_data + 1;
        CONTINUE;
      END IF;
      v_hora_abertura := v_excecao.hora_abertura::TIME;
      v_hora_fechamento := v_excecao.hora_fechamento::TIME;
      v_hora_almoco_inicio := v_excecao.hora_almoco_inicio::TIME;
      v_hora_almoco_fim := v_excecao.hora_almoco_fim::TIME;
      v_delay := 10;
    ELSE
      SELECT aberto, hora_abertura, hora_fechamento, hora_almoco_inicio, hora_almoco_fim
      INTO v_excecao
      FROM horarios_excepcionais
      WHERE data = v_data::TEXT
      LIMIT 1;

      IF FOUND THEN
        IF COALESCE(v_excecao.aberto, false) = false THEN
          v_data := v_data + 1;
          CONTINUE;
        END IF;
        v_hora_abertura := v_excecao.hora_abertura::TIME;
        v_hora_fechamento := v_excecao.hora_fechamento::TIME;
        v_hora_almoco_inicio := v_excecao.hora_almoco_inicio::TIME;
        v_hora_almoco_fim := v_excecao.hora_almoco_fim::TIME;
        v_delay := 10;
      ELSE
        SELECT aberto, hora_abertura, hora_fechamento, 
               hora_almoco_inicio, hora_almoco_fim, delay_entre_servicos
        INTO v_config
        FROM configuracoes_horario_barbeiro
        WHERE barbeiro_id = p_barbeiro_id
          AND dia_semana = v_dia_semana
        LIMIT 1;

        IF NOT FOUND OR COALESCE(v_config.aberto, false) = false THEN
          SELECT aberto, hora_abertura, hora_fechamento,
                 hora_almoco_inicio, hora_almoco_fim, delay_entre_servicos
          INTO v_config
          FROM configuracoes_horario
          WHERE dia_semana = v_dia_semana
          LIMIT 1;

          IF NOT FOUND OR COALESCE(v_config.aberto, false) = false THEN
            v_data := v_data + 1;
            CONTINUE;
          END IF;
        END IF;

        v_hora_abertura := v_config.hora_abertura::TIME;
        v_hora_fechamento := v_config.hora_fechamento::TIME;
        v_hora_almoco_inicio := v_config.hora_almoco_inicio::TIME;
        v_hora_almoco_fim := v_config.hora_almoco_fim::TIME;
        v_delay := COALESCE(v_config.delay_entre_servicos, 10);
      END IF;
    END IF;

    v_minutos_disponiveis := EXTRACT(EPOCH FROM (v_hora_fechamento - v_hora_abertura))::INT / 60;

    IF v_hora_almoco_inicio IS NOT NULL AND v_hora_almoco_fim IS NOT NULL THEN
      v_minutos_disponiveis := v_minutos_disponiveis 
        - (EXTRACT(EPOCH FROM (v_hora_almoco_fim - v_hora_almoco_inicio))::INT / 60);
    END IF;

    v_max_slots := GREATEST(1, v_minutos_disponiveis / (v_duracao_min + v_delay));

    SELECT COUNT(*) INTO v_appointments_count
    FROM agendamentos
    WHERE barbeiro_id = p_barbeiro_id
      AND data = v_data::TEXT
      AND status NOT IN ('cancelled_by_user', 'cancelled_by_admin', 'no_show');

    IF v_appointments_count < v_max_slots THEN
      RETURN v_data;
    END IF;

    v_data := v_data + 1;
  END LOOP;

  RETURN NULL;
END;
$$;
