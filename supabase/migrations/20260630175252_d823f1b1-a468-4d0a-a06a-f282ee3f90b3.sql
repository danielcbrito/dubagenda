
-- Lockdown SECURITY DEFINER non-trigger functions.
-- 1) Revoke EXECUTE from PUBLIC/anon/authenticated on every SECURITY DEFINER function in public
--    that is NOT a trigger function. Edge functions use service_role and are unaffected.
-- 2) Re-grant EXECUTE on the small allowlist of RPCs actually called by the frontend.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.prorettype <> 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
                   r.proname, r.args);
  END LOOP;
END $$;

-- Allowlist: frontend RPCs callable by AUTHENTICATED users
DO $$
DECLARE
  fn text;
  auth_allow text[] := ARRAY[
    'apply_cupom',
    'consume_available_redemptions_as_lost',
    'count_subscription_uses_in_cycle',
    'get_cupom_pendente_obrigatorio',
    'get_next_available_date',
    'get_or_create_wallet_balance',
    'get_user_available_credits',
    'get_user_tenant_id',
    'is_admin',
    'is_device_authorized',
    'mark_available_redemption_as_used',
    'use_credits_atomic',
    'user_has_active_redemption_appointment',
    'validate_cupom',
    'has_role'
  ];
  r record;
BEGIN
  FOREACH fn IN ARRAY auth_allow LOOP
    FOR r IN
      SELECT p.oid, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn AND p.prosecdef = true
    LOOP
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated', fn, r.args);
    END LOOP;
  END LOOP;
END $$;

-- Allowlist: RPCs callable BEFORE login (anon + authenticated)
DO $$
DECLARE
  fn text;
  anon_allow text[] := ARRAY[
    'get_maintenance_status',
    'get_store_maintenance_config',
    'is_email_allowed_maintenance',
    'get_tenant_banners',
    'get_admin_banner_for_barber'
  ];
  r record;
BEGIN
  FOREACH fn IN ARRAY anon_allow LOOP
    FOR r IN
      SELECT p.oid, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn AND p.prosecdef = true
    LOOP
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO anon, authenticated', fn, r.args);
    END LOOP;
  END LOOP;
END $$;
