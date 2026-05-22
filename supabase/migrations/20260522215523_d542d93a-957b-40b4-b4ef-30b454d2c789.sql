INSERT INTO public.resgates (user_id, promocao_id, status)
VALUES ('df8bc0ce-6963-4d3e-9ed6-7ff32d09c0c1', 'bf03dabc-cee6-46df-ae78-b6a4f4f82954', 'available');

UPDATE public.pontos 
SET pontos = 0 
WHERE user_id = 'df8bc0ce-6963-4d3e-9ed6-7ff32d09c0c1';