-- Vincular servico_id nos planos que estão nulos

-- Barbearia DUB: "Plano corte" → Corte
UPDATE planos SET servico_id = '72bf725d-6d94-4976-9246-ab318479f286' WHERE id = 'b9fae958-048b-4f3b-a278-e0cf6881f10e' AND servico_id IS NULL;

-- Barbearia DUB: "Plano Corte + Barba" → corte e barba
UPDATE planos SET servico_id = '67ad4f13-428a-443d-a648-86ececa63e27' WHERE id = 'a7fb0a5c-9f67-43fe-a26e-1bf0a8b59726' AND servico_id IS NULL;

-- Plano teste (inativo, tenant 73d61f2f): vincular a Corte desse tenant
UPDATE planos SET servico_id = '32a57676-8332-4153-8e7e-1d0949041ad8' WHERE id = '4c132fcf-2972-448e-947f-8d5bb525c47e' AND servico_id IS NULL;

-- Agora que todos os registros existentes tem servico_id, aplicar NOT NULL
ALTER TABLE planos ALTER COLUMN servico_id SET NOT NULL;