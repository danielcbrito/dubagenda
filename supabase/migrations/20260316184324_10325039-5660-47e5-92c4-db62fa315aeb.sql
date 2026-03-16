CREATE OR REPLACE FUNCTION public.get_tenant_banners(p_tenant_ids uuid[])
RETURNS TABLE(tenant_id uuid, banner_url text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT t.id AS tenant_id, p.banner_url
  FROM public.tenants t
  JOIN public.profiles p ON p.id = t.owner_user_id
  WHERE t.id = ANY(p_tenant_ids)
    AND p.banner_url IS NOT NULL
    AND p.banner_url <> ''
$$;