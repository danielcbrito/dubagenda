-- Corrigir o contador de usos do ciclo atual para refletir a liberação do no_show
UPDATE public.assinaturas
SET usos_ciclo_atual = (
  SELECT COUNT(*)::integer
  FROM public.plano_agendamentos_usos u
  JOIN public.agendamentos a ON a.id = u.agendamento_id
  WHERE u.assinatura_id = '2eac2cd3-f118-48ca-a27b-6a3f450eb551'
    AND u.released_at IS NULL
    AND COALESCE(a.status::text, '') NOT IN ('cancelled_by_user', 'cancelled_by_admin', 'excluido', 'no_show')
),
updated_at = now()
WHERE id = '2eac2cd3-f118-48ca-a27b-6a3f450eb551';