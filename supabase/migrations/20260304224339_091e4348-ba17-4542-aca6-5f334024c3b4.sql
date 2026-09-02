-- Backfill de logo da barbearia a partir do Storage (logos/tenant-logos)
-- Corrige casos em que logo_url está vazio ou aponta para imagem pessoal (avatar/foto de barbeiro)
WITH latest_logo AS (
  SELECT DISTINCT ON (o.owner)
    o.owner::uuid AS owner_user_id,
    (
      'https://djtpzvujzmrrslirzwun.supabase.co/storage/v1/object/public/'
      || o.bucket_id || '/' || o.name
    ) AS public_logo_url
  FROM storage.objects o
  WHERE o.bucket_id IN ('logos', 'tenant-logos')
    AND o.owner IS NOT NULL
  ORDER BY o.owner, o.created_at DESC
)
UPDATE public.tenants t
SET logo_url = ll.public_logo_url,
    updated_at = now()
FROM latest_logo ll
WHERE t.owner_user_id = ll.owner_user_id
  AND (
    t.logo_url IS NULL
    OR btrim(t.logo_url) = ''
    OR t.logo_url ILIKE '%/storage/v1/object/public/avatars/%'
    OR t.logo_url ILIKE '%/storage/v1/object/public/barber-photos/%'
  );