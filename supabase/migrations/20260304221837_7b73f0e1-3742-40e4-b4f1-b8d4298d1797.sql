
-- Remove the trigger that wrongly syncs owner avatar to tenant logo
-- The tenant logo should be managed independently from the owner's profile avatar
DROP TRIGGER IF EXISTS trg_sync_avatar_to_tenant_logo ON public.profiles;
DROP FUNCTION IF EXISTS public.sync_owner_avatar_to_tenant_logo();
