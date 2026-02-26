-- Primeiro: remover duplicatas mantendo apenas a avaliação mais recente por user+barber
DELETE FROM public.barbeiro_avaliacoes
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, barber_id) id
  FROM public.barbeiro_avaliacoes
  ORDER BY user_id, barber_id, created_at DESC
);

-- Remover constraint antiga de 1 por appointment (já foi dropada na migration anterior)
-- DROP INDEX IF EXISTS barber_reviews_unique_appointment;

-- Criar constraint de 1 avaliação por usuário+barbeiro
CREATE UNIQUE INDEX barber_reviews_unique_user_barber 
  ON public.barbeiro_avaliacoes (user_id, barber_id);