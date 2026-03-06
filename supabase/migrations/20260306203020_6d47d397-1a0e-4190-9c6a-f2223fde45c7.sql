
-- 1) Mover o barbeiro "barbearia silva" para o tenant DUB
UPDATE public.barbeiros
SET tenant_id = '73d61f2f-b369-41f3-8915-8e6de52d6378',
    updated_at = now()
WHERE id = 'f6780155-47c7-40b3-82fd-7e67eb038301';

-- 2) Vincular o perfil do dono à Barbearia DUB como preferida
UPDATE public.profiles
SET barbearia_preferida_id = '73d61f2f-b369-41f3-8915-8e6de52d6378'
WHERE id = '6dffbe7e-9a53-4138-ab72-ec6b3f9b0c25';
