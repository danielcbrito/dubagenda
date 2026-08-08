-- 1. Inserir primeiro agendamento manual (01/08/2026) em horário livre (08:00)
INSERT INTO public.agendamentos (
  user_id, barbeiro_id, servico_id, data, hora, duracao, status, 
  preco, preco_final, payment_method, observacoes
) VALUES (
  '46e1a2bd-2015-406e-b0e8-4786927f535d',
  'ee238642-bc38-4de6-ba86-9eed40262fc7',
  '32a57676-8332-4153-8e7e-1d0949041ad8',
  '2026-08-01',
  '08:00',
  30,
  'completed',
  0,
  0,
  'plan',
  'Registrado pela equipe de TI (Corte do plano feito particular)'
);

-- 2. Inserir segundo agendamento manual (05/08/2026) em horário livre (08:30)
INSERT INTO public.agendamentos (
  user_id, barbeiro_id, servico_id, data, hora, duracao, status, 
  preco, preco_final, payment_method, observacoes
) VALUES (
  '46e1a2bd-2015-406e-b0e8-4786927f535d',
  'ee238642-bc38-4de6-ba86-9eed40262fc7',
  '32a57676-8332-4153-8e7e-1d0949041ad8',
  '2026-08-05',
  '08:30',
  30,
  'completed',
  0,
  0,
  'plan',
  'Registrado pela equipe de TI (Corte do plano feito particular)'
);

-- 3. Registrar os usos do plano para esses novos agendamentos
INSERT INTO public.plano_agendamentos_usos (
  user_id, assinatura_id, agendamento_id, competencia
)
SELECT 
  user_id,
  '79002fd7-daaf-49e0-9981-86698bbedd97',
  id,
  '2026-08-01'
FROM public.agendamentos 
WHERE user_id = '46e1a2bd-2015-406e-b0e8-4786927f535d' 
AND observacoes = 'Registrado pela equipe de TI (Corte do plano feito particular)'
AND id NOT IN (SELECT agendamento_id FROM public.plano_agendamentos_usos WHERE user_id = '46e1a2bd-2015-406e-b0e8-4786927f535d');

-- 4. Verificação final
SELECT COUNT(*) as total_usos_agosto
FROM public.plano_agendamentos_usos 
WHERE user_id = '46e1a2bd-2015-406e-b0e8-4786927f535d' 
AND competencia = '2026-08-01';