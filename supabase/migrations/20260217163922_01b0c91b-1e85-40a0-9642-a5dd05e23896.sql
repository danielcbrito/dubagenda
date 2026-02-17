-- Fix Pedro's foto_url to point to his uploaded photo
UPDATE barbeiros 
SET foto_url = (
  SELECT CONCAT(
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1),
    '/storage/v1/object/public/avatars/barbeiros/barbeiros-5f8930bc-5d4f-4136-b97c-27a38730f994-1771344852537.webp'
  )
)
WHERE id = 'ee238642-bc38-4de6-ba86-9eed40262fc7' AND foto_url IS NULL;