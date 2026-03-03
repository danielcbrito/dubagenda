-- Fix Pedro Santos: assign to Barbearia DUB tenant (same as Tulio)
UPDATE barbeiros 
SET tenant_id = '73d61f2f-b369-41f3-8915-8e6de52d6378'
WHERE id = 'ee238642-bc38-4de6-ba86-9eed40262fc7' 
  AND tenant_id IS NULL;

-- Fix all DUB exclusive users: set their preferred shop to the actual DUB tenant
UPDATE profiles 
SET barbearia_preferida_id = '73d61f2f-b369-41f3-8915-8e6de52d6378'
WHERE barbearia_preferida_id IS NULL 
  AND signup_origin = 'dub_exclusive';