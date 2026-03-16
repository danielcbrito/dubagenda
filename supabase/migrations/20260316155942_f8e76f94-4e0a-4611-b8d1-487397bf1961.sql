-- Fix coordinates for all active units based on precise Nominatim geocoding

-- Barbearia DUB (Rua Ferrador, 108, Cidade Ipava, São Paulo, SP)
-- Old: -23.665, -46.735 → New: -23.7220, -46.7616
UPDATE public.tenant_unidades
SET latitude = -23.7219695, longitude = -46.7615913
WHERE id = '3bc7d50a-07a6-4ee5-aab9-8dc687011385';

-- unidade tres marias (Rua das Três Marias, 217, Parque Novo Santo Amaro, São Paulo, SP)
-- Old: -23.685, -46.748 → New: -23.7011, -46.7850
UPDATE public.tenant_unidades
SET latitude = -23.7011488, longitude = -46.7850317
WHERE id = '4cac2df4-48b4-4236-8b8b-0d67ea6095b9';

-- unidade m boi mirim (Rua das Três Marias, 217, Parque Novo Santo Amaro, São Paulo, SP)
-- Same address as tres marias - using same precise coordinates
-- Old: -23.705, -46.762 → New: -23.7011, -46.7850
UPDATE public.tenant_unidades
SET latitude = -23.7011488, longitude = -46.7850317
WHERE id = '3f6cdbcb-3fa5-41c6-9e8c-e138df0b9660';

-- ffff (Rua Alexandre Gomes Chaves, 85, Itararé, Teresina, PI)
-- Old: -5.069, -42.786 → New: -5.1006, -42.7561
UPDATE public.tenant_unidades
SET latitude = -5.1006495, longitude = -42.7561462
WHERE id = 'db1505e7-5b03-458f-82ee-ac73fc9de457';