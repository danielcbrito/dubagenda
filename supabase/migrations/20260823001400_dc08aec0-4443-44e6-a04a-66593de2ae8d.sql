-- Corrigir agendamento marcado por engano como concluído (cliente faltou)
UPDATE public.agendamentos
SET status = 'no_show'
WHERE id = 'bfc99d60-0884-4b6c-8b93-ca2d61dd9da9';

-- Garantir liberação da cota do plano usada nesse agendamento
UPDATE public.plano_agendamentos_usos
SET released_at = COALESCE(released_at, now())
WHERE agendamento_id = 'bfc99d60-0884-4b6c-8b93-ca2d61dd9da9';

-- Recalcular usos do ciclo atual da assinatura
UPDATE public.assinaturas a
SET usos_ciclo_atual = (
  SELECT COUNT(*) FROM public.plano_agendamentos_usos u
  WHERE u.assinatura_id = a.id
    AND u.competencia = date_trunc('month', a.ciclo_inicio)::date
    AND u.released_at IS NULL
),
updated_at = now()
WHERE a.id = '295f7cbd-a496-41a5-b904-e75ea300db94';