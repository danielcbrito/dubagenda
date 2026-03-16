-- Corrige a unidade principal da Barbearia DUB para o endereço informado pelo usuário
UPDATE public.tenant_unidades
SET
  rua = 'Rua Ferrador',
  numero = '108',
  bairro = 'Cidade Ipava',
  cidade = 'São Paulo',
  estado = 'SP',
  cep = '04950-040',
  latitude = -23.725450012705,
  longitude = -46.76093100885,
  updated_at = now()
WHERE id = '3bc7d50a-07a6-4ee5-aab9-8dc687011385';