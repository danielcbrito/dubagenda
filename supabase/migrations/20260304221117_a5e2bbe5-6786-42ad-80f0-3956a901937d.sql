
-- One-time sync: populate tenants.logo_url from owner's avatar_url where missing
UPDATE public.tenants t
SET logo_url = p.avatar_url, updated_at = now()
FROM public.profiles p
WHERE t.owner_user_id = p.id
  AND p.avatar_url IS NOT NULL
  AND p.avatar_url <> ''
  AND (t.logo_url IS NULL OR t.logo_url = '');
