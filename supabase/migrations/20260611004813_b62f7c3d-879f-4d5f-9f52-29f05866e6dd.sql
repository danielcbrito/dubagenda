CREATE OR REPLACE FUNCTION public.auto_convert_encaixe_to_plano()
 RETURNS trigger
 LANGUAGE plpgsql
 AS $function$
DECLARE
  v_assinatura RECORD;
  v_servico_in_plan boolean := false;
BEGIN
  -- Só processa agendamentos criados por barbeiros para clientes existentes
  IF NEW.criado_por <> 'barbeiro' THEN RETURN NEW; END IF;
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  
  -- Se for um encaixe manual ou normal (não via cliente app diretamente)
  IF NEW.tipo_agendamento NOT IN ('encaixe_manual', 'normal') THEN RETURN NEW; END IF;

  -- Busca assinatura ativa do cliente para este barbeiro/barbearia
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

  -- Verifica se o serviço faz parte do plano
  SELECT EXISTS(
    SELECT 1 FROM public.plano_servicos ps
    WHERE ps.plano_id = v_assinatura.plano_id AND ps.servico_id = NEW.servico_id
  ) OR (v_assinatura.servico_id = NEW.servico_id)
  INTO v_servico_in_plan;

  IF NOT v_servico_in_plan THEN RETURN NEW; END IF;

  -- Verifica limite de uso
  IF v_assinatura.limite_agendamentos_mes IS NOT NULL
     AND COALESCE(v_assinatura.usos_ciclo_atual, 0) >= v_assinatura.limite_agendamentos_mes THEN
    RETURN NEW;
  END IF;

  -- Converte para plano
  NEW.tipo_agendamento := 'plano';
  NEW.payment_method := 'plano';
  NEW.is_free := true;
  NEW.preco := 0;
  
  -- Se for agendado para hoje ou passado, já marca como concluído para aparecer no histórico
  IF NEW.data <= CURRENT_DATE THEN
    NEW.status := 'completed';
  END IF;

  RETURN NEW;
END;
$function$;