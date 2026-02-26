-- Desativar tenants de teste
UPDATE tenants SET ativo = false WHERE id IN ('763c7335-f65b-4d6c-95c7-60c824196c51', '1dea5b20-278b-446c-9bf1-9a94fc0a96c3');