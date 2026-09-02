
-- Mover exceção global do dia 23 para exceção específica do barbeiro Santos
DELETE FROM public.horarios_excepcionais WHERE id = '8341addf-7ee2-4fd4-884a-3d318d2f2a12';

INSERT INTO public.horarios_excepcionais_barbeiro (barbeiro_id, data, aberto, motivo)
VALUES ('afb89c07-cad2-4d87-be85-a9793eda91dd', '2026-02-23', false, NULL)
ON CONFLICT DO NOTHING;
