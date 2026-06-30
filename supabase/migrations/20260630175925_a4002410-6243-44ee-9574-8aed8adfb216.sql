-- Restore EXECUTE on SECURITY DEFINER helpers required by RLS policies
GRANT EXECUTE ON FUNCTION public.is_tenant_owner_by_tenant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_preferred_tenant_id() TO authenticated;