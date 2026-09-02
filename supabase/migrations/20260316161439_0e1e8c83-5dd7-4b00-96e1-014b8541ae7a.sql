-- Ativar a unidade de Alphaville da Barbearia DUB e corrigir endereço/coordenadas
-- Coordenadas de Alphaville, Barueri/SP: -23.4953, -46.8492
UPDATE tenant_unidades 
SET ativo = true,
    cidade = 'Barueri',
    estado = 'SP',
    latitude = -23.4953,
    longitude = -46.8492
WHERE id = '4001e1b1-0e0e-4170-bb61-b7015564f6ad';