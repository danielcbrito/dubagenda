CREATE OR REPLACE FUNCTION public.auto_convert_encaixe_to_plano()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assinatura RECORD;
  v_servico_in_plan boolean := false;
BEGIN
  IF NEW.criado_por <> 'barbeiro' THEN RETURN NEW; END IF;
  IF NEW.tipo_agendamento <> 'encaixe_manual' THEN RETURN NEW; END IF;
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.payment_method = 'plano' OR NEW.tipo_agendamento = 'plano' THEN RETURN NEW; END IF;

  SELECT a.id, a.plano_id, a.ciclo_inicio, a.ciclo_fim, a.usos_ciclo_atual,
         p.limite_agendamentos_mes, p.servico_id
  INTO v_assinatura
  FROM public.assinaturas a
  JOIN public.planos p ON p.id = a.plano_id
  WHERE a.user_id = NEW.user_id
    AND a.status = 'active'
    AND a.barbeiro_id = NEW.barbeiro_id
    AND NEW.data >= COALESCE(a.ciclo_inicio, NEW.data)
    AND NEW.data <= COALESCE(a.ciclo_fim, NEW.data)
  ORDER BY a.created_at DESC
  LIMIT 1;

  IF v_assinatura.id IS NULL THEN RETURN NEW; END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.plano_servicos ps
    WHERE ps.plano_id = v_assinatura.plano_id AND ps.servico_id = NEW.servico_id
  ) OR (v_assinatura.servico_id = NEW.servico_id)
  INTO v_servico_in_plan;

  IF NOT v_servico_in_plan THEN RETURN NEW; END IF;

  IF v_assinatura.limite_agendamentos_mes IS NOT NULL
     AND COALESCE(v_assinatura.usos_ciclo_atual, 0) >= v_assinatura.limite_agendamentos_mes THEN
    RETURN NEW;
  END IF;

  NEW.tipo_agendamento := 'plano';
  NEW.payment_method := 'plano';
  NEW.is_free := true;
  NEW.preco := 0;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_convert_encaixe_to_plano ON public.agendamentos;
CREATE TRIGGER trg_auto_convert_encaixe_to_plano
BEFORE INSERT ON public.agendamentos
FOR EACH ROW
EXECUTE FUNCTION public.auto_convert_encaixe_to_plano();