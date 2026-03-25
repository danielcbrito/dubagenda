UPDATE public.assinaturas 
SET next_billing_date = '2026-03-31',
    updated_at = now()
WHERE id = '3e23a990-3a63-43e5-88fd-599c5803d126' 
  AND user_id = 'fde0117a-b9bb-4e38-9132-e096245af670';