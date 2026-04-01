-- Esgota automaticamente o plano ativo do cliente danielcbrito74@gmail.com
-- Preenche os 4 cortes usados com base no limite do plano ativo

WITH cliente AS (
  SELECT id
  FROM auth.users
  WHERE lower(email) = lower('danielcbrito74@gmail.com')
  LIMIT 1
)
UPDATE public.assinaturas AS a
SET usos_ciclo_atual = p.limite_agendamentos_mes,
    updated_at = now()
FROM public.planos AS p, cliente
WHERE a.plano_id = p.id
  AND a.user_id = cliente.id
  AND a.status = 'active';

-- Conferência do resultado
SELECT
  a.id AS assinatura_id,
  p.nome AS plano,
  a.status,
  a.usos_ciclo_atual,
  p.limite_agendamentos_mes
FROM public.assinaturas AS a
JOIN public.planos AS p ON p.id = a.plano_id
JOIN auth.users AS u ON u.id = a.user_id
WHERE lower(u.email) = lower('danielcbrito74@gmail.com')
  AND a.status = 'active';
