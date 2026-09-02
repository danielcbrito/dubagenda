-- 1. Converter agendamento para tipo plano
UPDATE public.agendamentos
SET
  tipo_agendamento = 'plano',
  payment_method = 'plano',
  is_free = true,
  preco = 0,
  updated_at = now()
WHERE id = '03fd529b-d03c-4b02-aa39-ede54968d635';

-- 2. Incrementar uso do ciclo na assinatura
UPDATE public.assinaturas
SET
  usos_ciclo_atual = usos_ciclo_atual + 1,
  updated_at = now()
WHERE id = 'c643c088-bd72-4b7e-832b-c24d40356ddf';