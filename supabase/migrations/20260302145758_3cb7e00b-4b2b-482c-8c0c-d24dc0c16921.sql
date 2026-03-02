
-- 1) Adicionar RLS policies para tabelas financeiras
-- financeiro_auth_attempts: apenas service role / admin deveria acessar
CREATE POLICY "Authenticated users can insert own auth attempts"
ON public.financeiro_auth_attempts FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own auth attempts"
ON public.financeiro_auth_attempts FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- financeiro_auth_sessions
CREATE POLICY "Users can manage own auth sessions"
ON public.financeiro_auth_sessions FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- financeiro_security_config: apenas admins
CREATE POLICY "Only admins can view security config"
ON public.financeiro_security_config FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Only admins can update security config"
ON public.financeiro_security_config FOR UPDATE
TO authenticated
USING (public.is_admin());

-- 2) Corrigir view barbeiros_public para suportar multi-tenant
DROP VIEW IF EXISTS public.barbeiros_public;
CREATE VIEW public.barbeiros_public 
WITH (security_invoker = true)
AS
SELECT id, apelido, foto_url, ativo, tenant_id
FROM barbeiros
WHERE ativo = true AND deleted_at IS NULL;
