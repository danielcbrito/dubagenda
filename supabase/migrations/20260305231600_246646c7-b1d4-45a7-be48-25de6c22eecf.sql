-- Backfill global de usos de plano ausentes para evitar subcontagem no app
WITH missing_plan_appointments AS (
  SELECT
    ag.id AS agendamento_id,
    ag.user_id,
    ag.created_at,
    date_trunc('month', ag.data)::date AS competencia
  FROM public.agendamentos ag
  LEFT JOIN public.plano_agendamentos_usos u ON u.agendamento_id = ag.id
  WHERE (ag.payment_method = 'plano' OR ag.tipo_agendamento = 'plano')
    AND ag.status NOT IN ('cancelled_by_user', 'cancelled_by_admin')
    AND u.id IS NULL
),
mapped_subscriptions AS (
  SELECT
    m.agendamento_id,
    m.user_id,
    m.competencia,
    COALESCE(
      (
        SELECT a.id
        FROM public.assinaturas a
        WHERE a.user_id = m.user_id
          AND a.created_at <= m.created_at
        ORDER BY a.created_at DESC
        LIMIT 1
      ),
      (
        SELECT a2.id
        FROM public.assinaturas a2
        WHERE a2.user_id = m.user_id
        ORDER BY a2.created_at DESC
        LIMIT 1
      )
    ) AS assinatura_id
  FROM missing_plan_appointments m
)
INSERT INTO public.plano_agendamentos_usos (user_id, assinatura_id, agendamento_id, competencia)
SELECT
  ms.user_id,
  ms.assinatura_id,
  ms.agendamento_id,
  ms.competencia
FROM mapped_subscriptions ms
WHERE ms.assinatura_id IS NOT NULL
ON CONFLICT (agendamento_id) DO NOTHING;