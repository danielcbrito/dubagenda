-- Fix DUB services: assign them to the Barbearia DUB tenant
-- These services currently have tenant_id = null but should belong to the DUB tenant
UPDATE servicos 
SET tenant_id = '73d61f2f-b369-41f3-8915-8e6de52d6378'
WHERE tenant_id IS NULL 
  AND ativo = true;