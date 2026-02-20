-- Desativar todas as barbearias de teste que não são a DUB
-- Essas barbearias foram criadas como teste e precisam ser desativadas
UPDATE public.tenants 
SET ativo = false 
WHERE id IN (
  '9aff88c6-5762-4e53-b26a-37b25264d73d',  -- Babrbearia pinto
  'e995c8fe-e456-48cc-87ec-01f05cd5a3a3',  -- Barbbearia pinto
  'd9ca241c-99da-431d-b1c2-f1ddb7939ce7',  -- Barbearia pinto
  'a51d9c73-5b95-4e52-a39e-ff2fbaae983b',  -- Barbearia pinto (onboarding false)
  'c0b4e3b8-523e-409b-af40-57de6ac55f02',  -- Barbearia pinto
  'f6aa3865-6f57-4262-bdf5-e64579308e53',  -- barbearia santos
  'e1df0a70-d316-4a5a-9174-edc28b9fce04',  -- santos
  'f65b232a-c9b6-4b61-8363-84327619eff2'   -- teste
);