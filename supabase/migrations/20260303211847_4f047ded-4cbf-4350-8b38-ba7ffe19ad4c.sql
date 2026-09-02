-- Fix DUB planos: assign them to the Barbearia DUB tenant
UPDATE planos 
SET tenant_id = '73d61f2f-b369-41f3-8915-8e6de52d6378'
WHERE tenant_id IS NULL;

-- Fix DUB promoções: assign them to the Barbearia DUB tenant
UPDATE promocoes 
SET tenant_id = '73d61f2f-b369-41f3-8915-8e6de52d6378'
WHERE tenant_id IS NULL;