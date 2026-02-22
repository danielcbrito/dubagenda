-- Deactivate the older duplicate "Barbearia Dos Santos" (owner removed from auth)
UPDATE public.tenants 
SET ativo = false 
WHERE id = 'af5e3ab2-3b33-43ac-ada9-682a141b6dcf';