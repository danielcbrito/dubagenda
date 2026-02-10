UPDATE public.pontos 
SET pontos = pontos + 1, 
    last_awarded_at = NOW(), 
    updated_at = NOW() 
WHERE user_id = 'df8bc0ce-6963-4d3e-9ed6-7ff32d09c0c1';