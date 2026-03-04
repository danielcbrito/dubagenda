
-- Trigger: when profile.avatar_url changes, sync to tenants.logo_url
CREATE OR REPLACE FUNCTION public.sync_owner_avatar_to_tenant_logo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.avatar_url IS DISTINCT FROM OLD.avatar_url THEN
    UPDATE public.tenants
    SET logo_url = NEW.avatar_url,
        updated_at = now()
    WHERE owner_user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_avatar_to_tenant_logo ON public.profiles;
CREATE TRIGGER trg_sync_avatar_to_tenant_logo
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_owner_avatar_to_tenant_logo();
