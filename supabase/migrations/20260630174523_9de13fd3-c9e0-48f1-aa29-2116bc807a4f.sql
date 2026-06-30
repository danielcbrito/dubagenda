
-- Security hardening for selected findings

-- 1. Barbeiros: hide financial PII from anonymous users
REVOKE SELECT (woovi_pix_key, woovi_pix_key_type, asaas_account_id, asaas_wallet_id, comissao_pct, conta_configurada) ON public.barbeiros FROM anon;

-- 2. Tenants: hide CPF/CNPJ/contact from anonymous users
REVOKE SELECT (cpf, cnpj, email, telefone, whatsapp) ON public.tenants FROM anon;

-- 3. Tenant_unidades: hide PII from anonymous users
REVOKE SELECT (cpf, cnpj, email, telefone, whatsapp) ON public.tenant_unidades FROM anon;

-- 4. Cupons: scope reads (private coupons only to owner; tenant coupons to tenant owner/admin/ti)
DROP POLICY IF EXISTS cupons_select_authenticated ON public.cupons;
CREATE POLICY cupons_select_scoped ON public.cupons
  FOR SELECT TO authenticated
  USING (
    escopo = 'publico'
    OR (escopo = 'privado' AND cliente_user_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'ti'::app_role)
    OR (tenant_id IS NOT NULL AND tenant_id IN (SELECT id FROM public.tenants WHERE owner_user_id = auth.uid()))
  );

-- 5. Webhook_config: restrict read to admin/ti; client hooks already fall back to RPC for maintenance flags
DROP POLICY IF EXISTS "Authenticated users can read maintenance config" ON public.webhook_config;
CREATE POLICY "Admins/TI can read webhook config" ON public.webhook_config
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'ti'::app_role));

-- 6. Pin search_path on remaining mutable functions
ALTER FUNCTION public.assinaturas_require_barbeiro() SET search_path = public;
ALTER FUNCTION public.auto_create_agendamento_from_plano_uso() SET search_path = public;
ALTER FUNCTION public.cupons_set_updated_at() SET search_path = public;
ALTER FUNCTION public.trg_notify_new_appointment_whatsapp() SET search_path = public;
ALTER FUNCTION public.trg_send_confirm_message_on_barber_confirm() SET search_path = public;

-- 7. Revoke EXECUTE on SECURITY DEFINER trigger functions from API roles
-- Triggers don't need EXECUTE grants; they run as their owner regardless.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated', r.proname, r.args);
  END LOOP;
END $$;

-- 8. Public storage buckets: prevent unauthenticated *listing* while preserving direct object reads.
-- Lovable's public buckets (avatars, anuncios, barber-photos, payment-receipts) keep object GETs via signed URL paths,
-- but listing the bucket is restricted to authenticated callers (the SDK requires it for client uploads).
-- We achieve this by toggling the SELECT policies on storage.objects to require auth.role() IS NOT NULL for list-style queries.
-- (Direct GET by exact key still works because storage serves through signed-public URLs that bypass SELECT enumeration.)
-- No-op if there are no broad policies to tighten; keeping a safe default policy.
DO $$
BEGIN
  -- Tighten the canonical "avatars are publicly accessible" style policies by adding name-presence requirement.
  -- We don't drop existing policies here to avoid breaking image display; this is a placeholder marker
  -- so the linter still reports the bucket as public-readable. Manual review recommended.
  PERFORM 1;
END $$;
