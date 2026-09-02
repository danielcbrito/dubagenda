
-- 1. Convert today's appointment to plan type
UPDATE public.agendamentos
SET payment_method = 'plano',
    tipo_agendamento = 'plano',
    is_free = true,
    preco = 0,
    updated_at = now()
WHERE id = '40d46d2c-4701-4962-886c-494169ec2335';

-- 2. Register plan usage for this appointment
INSERT INTO public.plano_agendamentos_usos (user_id, assinatura_id, agendamento_id, competencia)
VALUES (
  '46e1a2bd-2015-406e-b0e8-4786927f535d',
  '49f7b956-cafe-422e-94e4-c2f8d7b786bc',
  '40d46d2c-4701-4962-886c-494169ec2335',
  '2026-02-01'
)
ON CONFLICT (agendamento_id) DO NOTHING;
