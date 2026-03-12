-- Etapa 1: Vincular barbeiros órfãos ao tenant DUB
UPDATE barbeiros 
SET tenant_id = '73d61f2f-b369-41f3-8915-8e6de52d6378'
WHERE id IN (
    '7184c647-9d52-4024-ab06-5febc5488f72',
    '9e55a4fb-37f9-49d3-81b0-9fc6b6cea83b'
)
AND tenant_id IS NULL;

-- Deletar Orlando (0 agendamentos, inativo)
DELETE FROM barbeiros 
WHERE id = 'cb5d06ae-8254-4290-a9d1-60369c249dc5'
AND tenant_id IS NULL;

-- Deletar serviço "corte teste" (0 agendamentos)
DELETE FROM servicos 
WHERE id = 'ccfddfb5-2032-4e57-be6a-652ed0470b0b'
AND tenant_id IS NULL;

-- Etapa 2: Fechar o buraco permanentemente
ALTER TABLE barbeiros ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE servicos ALTER COLUMN tenant_id SET NOT NULL;