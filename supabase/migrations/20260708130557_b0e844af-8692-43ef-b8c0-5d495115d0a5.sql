-- Fix public Data API reads failing when anonymous requests evaluate admin-only RLS predicates.
-- Admin/role policies must not be attached to the public database role because anon users
-- cannot and should not execute role-checking logic.

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _user_id IS NULL THEN false
    WHEN auth.uid() IS NULL THEN false
    WHEN _user_id <> auth.uid() THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = _role
    )
  END
$$;

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND 'public' = ANY (roles::text[])
      AND (
        COALESCE(qual, '') ILIKE '%has_role%'
        OR COALESCE(with_check, '') ILIKE '%has_role%'
      )
  LOOP
    EXECUTE format(
      'ALTER POLICY %I ON %I.%I TO authenticated',
      pol.policyname,
      pol.schemaname,
      pol.tablename
    );
  END LOOP;
END $$;