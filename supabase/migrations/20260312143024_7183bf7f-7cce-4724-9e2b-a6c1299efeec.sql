-- ============================================
-- FIX: Corrigir RLS policies permissivas
-- mensagem_templates + tenant_cakto_events
-- ============================================

-- 1. mensagem_templates: policies dizem "Admins" mas usam USING(true)
-- Corrigir para usar has_role() de verdade

DROP POLICY IF EXISTS "Admins podem ler templates" ON public.mensagem_templates;
CREATE POLICY "Admins podem ler templates"
  ON public.mensagem_templates
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins podem inserir templates" ON public.mensagem_templates;
CREATE POLICY "Admins podem inserir templates"
  ON public.mensagem_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins podem editar templates" ON public.mensagem_templates;
CREATE POLICY "Admins podem editar templates"
  ON public.mensagem_templates
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. tenant_cakto_events: restringir a service_role apenas
-- Tabela vazia, sem uso no frontend, usada apenas por webhook

DROP POLICY IF EXISTS "Service role manages cakto events" ON public.tenant_cakto_events;
CREATE POLICY "Service role manages cakto events"
  ON public.tenant_cakto_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);