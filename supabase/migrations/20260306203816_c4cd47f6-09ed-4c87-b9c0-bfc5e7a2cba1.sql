-- Remove barbeiro "barbearia silva" (id: f6780155-47c7-40b3-82fd-7e67eb038301)

-- 1. Avaliações
DELETE FROM public.barbeiro_avaliacoes WHERE barber_id = 'f6780155-47c7-40b3-82fd-7e67eb038301';

-- 2. Configurações de horário
DELETE FROM public.configuracoes_horario_barbeiro WHERE barbeiro_id = 'f6780155-47c7-40b3-82fd-7e67eb038301';

-- 3. Horários excepcionais
DELETE FROM public.horarios_excepcionais_barbeiro WHERE barbeiro_id = 'f6780155-47c7-40b3-82fd-7e67eb038301';

-- 4. Google tokens
DELETE FROM public.barbeiro_google_tokens WHERE barbeiro_id = 'f6780155-47c7-40b3-82fd-7e67eb038301';

-- 5. Comissões
DELETE FROM public.comissoes WHERE barbeiro_id = 'f6780155-47c7-40b3-82fd-7e67eb038301';

-- 6. Chaves pix
DELETE FROM public.chaves_pix WHERE barbeiro_id = 'f6780155-47c7-40b3-82fd-7e67eb038301';

-- 7. Contas bancárias
DELETE FROM public.contas_bancarias WHERE barbeiro_id = 'f6780155-47c7-40b3-82fd-7e67eb038301';

-- 8. Barbeiros private
DELETE FROM public.barbeiros_private WHERE barbeiro_id = 'f6780155-47c7-40b3-82fd-7e67eb038301';

-- 9. Finally delete the barber
DELETE FROM public.barbeiros WHERE id = 'f6780155-47c7-40b3-82fd-7e67eb038301';