
-- Restaurar todas as assinaturas deletadas com os IDs originais
-- para manter integridade com plano_agendamentos_usos

INSERT INTO public.assinaturas (id, user_id, plano_id, status, payment_method, usos_ciclo_atual, next_billing_date, cash_payment_confirmed, created_at, updated_at)
VALUES
  -- Daniel Brito: 0 usos em abril (todos cancelados)
  ('91f0c38c-08a9-4ec1-9b38-88cbd710bb6a', 'df8bc0ce-6963-4d3e-9ed6-7ff32d09c0c1', '68e5bc5f-ca95-4999-9262-008de78d638e', 'active', 'cash', 0, '2026-05-01', true, now(), now()),
  
  -- Gutemberg Almeida: 4 usos em abril (esgotado)
  ('c643c088-bd72-4b7e-832b-c24d40356ddf', 'c6e726ba-5657-4cf2-94db-ff9ac2e7a1a6', '68e5bc5f-ca95-4999-9262-008de78d638e', 'active', 'cash', 4, '2026-05-01', true, now(), now()),
  
  -- Wilson Ferreira: 3 usos em abril
  ('8a185541-0de7-452b-a9b7-89ae81756561', 'fde0117a-b9bb-4e38-9132-e096245af670', '68e5bc5f-ca95-4999-9262-008de78d638e', 'active', 'cash', 3, '2026-05-01', true, now(), now()),
  
  -- Luis Guilherme Batista neves: 2 usos em abril
  ('2eac2cd3-f118-48ca-a27b-6a3f450eb551', '9f7dcdba-941a-44c9-aee8-dbb6e7a64e0a', '68e5bc5f-ca95-4999-9262-008de78d638e', 'active', 'cash', 2, '2026-05-01', true, now(), now()),
  
  -- Kaique Silvio de oliveira: 1 uso em abril
  ('5734e863-6e76-45a3-9786-ecf54ce084fc', '9135b3bf-ed0f-493d-b74c-1e3675d68616', '68e5bc5f-ca95-4999-9262-008de78d638e', 'active', 'cash', 1, '2026-05-01', true, now(), now()),
  
  -- Lucas Alcantara pasternack: 0 usos em abril
  ('49f7b956-cafe-422e-94e4-c2f8d7b786bc', '46e1a2bd-2015-406e-b0e8-4786927f535d', '68e5bc5f-ca95-4999-9262-008de78d638e', 'active', 'cash', 0, '2026-05-01', true, now(), now()),
  
  -- Tulio Santos: 0 usos em abril
  ('09eb1333-a505-4ca1-8b46-17dbfe7b392d', '99ca8171-b9f5-4d7f-986b-949dde99c778', '68e5bc5f-ca95-4999-9262-008de78d638e', 'active', 'cash', 0, '2026-05-01', true, now(), now()),
  
  -- CLEIDIMAR ARAUJO DE OLIVEIRA: 0 usos em abril
  ('5e7346c8-4318-4a1f-abf2-e5f534bd2de9', '53f11e14-f14d-4e63-b56f-c0ac0dce9d6c', '68e5bc5f-ca95-4999-9262-008de78d638e', 'active', 'cash', 0, '2026-05-01', true, now(), now())

ON CONFLICT (id) DO NOTHING;
