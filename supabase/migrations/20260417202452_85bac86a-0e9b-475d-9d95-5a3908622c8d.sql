-- Esgotar manualmente o plano do cliente Luis Guilherme Batista Neves
-- Ajusta usos_ciclo_atual = 4 (limite do plano) para refletir 4/4 na UI.
UPDATE public.assinaturas
SET usos_ciclo_atual = 4,
    updated_at = now()
WHERE id = '2eac2cd3-f118-48ca-a27b-6a3f450eb551';