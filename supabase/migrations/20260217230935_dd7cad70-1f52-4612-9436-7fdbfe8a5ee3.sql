-- Vincular todas as assinaturas ativas existentes ao barbeiro Túlio
UPDATE public.assinaturas 
SET barbeiro_id = '767c51a7-7323-4933-8fc5-9a666f6baa7c',
    updated_at = now()
WHERE status = 'active' 
  AND (barbeiro_id IS NULL OR barbeiro_id != '767c51a7-7323-4933-8fc5-9a666f6baa7c');