CREATE OR REPLACE FUNCTION public.owns_cancellation_debt(p_tenant uuid,p_barber text,p_client text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$ SELECT auth.uid() IS NOT NULL AND p_client IS DISTINCT FROM auth.uid()::text AND EXISTS(SELECT 1 FROM public.barbeiros b WHERE b.id::text=p_barber AND b.tenant_id=p_tenant AND b.user_id=auth.uid() AND b.ativo=true AND b.deleted_at IS NULL) $$;
REVOKE ALL ON FUNCTION public.owns_cancellation_debt(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.owns_cancellation_debt(uuid,text,text) TO authenticated,service_role;

DROP POLICY cancellation_debt_private_read ON public.informacoes_empresa;
CREATE POLICY cancellation_debt_private_read ON public.informacoes_empresa AS RESTRICTIVE FOR SELECT TO anon,authenticated USING (
(categoria<>'debitos_cliente' AND chave NOT LIKE 'debito_cancelamento_%') OR
(tenant_id IS NOT NULL AND (chave='debito_cancelamento_'||auth.uid()::text OR EXISTS(SELECT 1 FROM public.tenants t WHERE t.id=tenant_id AND t.owner_user_id=auth.uid()) OR public.has_role(auth.uid(),'ti') OR (auth.uid() IS NOT NULL AND public.owns_cancellation_debt(tenant_id,valor::jsonb->>'barbeiro_id',valor::jsonb->>'cliente_id')))));
CREATE POLICY cancellation_debt_barber_read ON public.informacoes_empresa FOR SELECT TO authenticated USING (
 categoria='debitos_cliente' AND tenant_id IS NOT NULL AND chave='debito_cancelamento_'||(valor::jsonb->>'cliente_id') AND public.owns_cancellation_debt(tenant_id,valor::jsonb->>'barbeiro_id',valor::jsonb->>'cliente_id'));
DROP POLICY cancellation_debt_no_client_update ON public.informacoes_empresa;
CREATE POLICY cancellation_debt_no_client_update ON public.informacoes_empresa AS RESTRICTIVE FOR UPDATE TO anon,authenticated USING (
(categoria<>'debitos_cliente' AND chave NOT LIKE 'debito_cancelamento_%') OR (auth.uid() IS NOT NULL AND categoria='debitos_cliente' AND tenant_id IS NOT NULL AND chave='debito_cancelamento_'||(valor::jsonb->>'cliente_id') AND public.owns_cancellation_debt(tenant_id,valor::jsonb->>'barbeiro_id',valor::jsonb->>'cliente_id')))
WITH CHECK ((categoria<>'debitos_cliente' AND chave NOT LIKE 'debito_cancelamento_%') OR (auth.uid() IS NOT NULL AND categoria='debitos_cliente' AND tenant_id IS NOT NULL AND chave='debito_cancelamento_'||(valor::jsonb->>'cliente_id') AND public.owns_cancellation_debt(tenant_id,valor::jsonb->>'barbeiro_id',valor::jsonb->>'cliente_id')));
CREATE POLICY cancellation_debt_barber_release ON public.informacoes_empresa FOR UPDATE TO authenticated USING (
 categoria='debitos_cliente' AND public.owns_cancellation_debt(tenant_id,valor::jsonb->>'barbeiro_id',valor::jsonb->>'cliente_id'))
WITH CHECK (categoria='debitos_cliente' AND public.owns_cancellation_debt(tenant_id,valor::jsonb->>'barbeiro_id',valor::jsonb->>'cliente_id'));

CREATE OR REPLACE FUNCTION public.guard_barber_debt_release()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE o jsonb; n jsonb;
BEGIN
IF auth.role() IS DISTINCT FROM 'authenticated' THEN RETURN NEW; END IF;
IF OLD.categoria<>'debitos_cliente' AND OLD.chave NOT LIKE 'debito_cancelamento_%' AND NEW.categoria<>'debitos_cliente' AND NEW.chave NOT LIKE 'debito_cancelamento_%' THEN RETURN NEW; END IF;
o:=OLD.valor::jsonb; n:=NEW.valor::jsonb;
IF NOT public.owns_cancellation_debt(OLD.tenant_id,o->>'barbeiro_id',o->>'cliente_id') OR
(to_jsonb(NEW)-ARRAY['valor','ativo','atualizado_em']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['valor','ativo','atualizado_em']) OR
(n-ARRAY['status','dispensado_em','liberado_em']) IS DISTINCT FROM (o-ARRAY['status','dispensado_em','liberado_em']) OR
n->>'status' NOT IN ('liberado_manual','dispensado') OR n->>'status' IS NULL OR
(o->>'status' IS DISTINCT FROM 'pendente' AND o->>'status' IS DISTINCT FROM n->>'status') THEN
RAISE EXCEPTION 'UNAUTHORIZED_CANCELLATION_DEBT_CHANGE' USING ERRCODE='42501'; END IF;
NEW.atualizado_em:=now(); RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_barber_debt_release() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_barber_debt_release BEFORE UPDATE ON public.informacoes_empresa FOR EACH ROW EXECUTE FUNCTION public.guard_barber_debt_release();

DO $$ DECLARE previous_sub text:=current_setting('request.jwt.claim.sub',true); BEGIN
PERFORM set_config('request.jwt.claim.sub','a46b3160-c1ca-478c-8a8b-68f50a82d27d',true);
ASSERT public.owns_cancellation_debt('73d61f2f-b369-41f3-8915-8e6de52d6378','767c51a7-7323-4933-8fc5-9a666f6baa7c','65b929ae-b44a-4270-8f56-d2d38c16fd91'), 'linked barber must have access';
ASSERT NOT public.owns_cancellation_debt('00000000-0000-0000-0000-000000000001','767c51a7-7323-4933-8fc5-9a666f6baa7c','65b929ae-b44a-4270-8f56-d2d38c16fd91'), 'wrong tenant denied';
ASSERT NOT public.owns_cancellation_debt('73d61f2f-b369-41f3-8915-8e6de52d6378','767c51a7-7323-4933-8fc5-9a666f6baa7c','a46b3160-c1ca-478c-8a8b-68f50a82d27d'), 'self release denied';
PERFORM set_config('request.jwt.claim.sub','65b929ae-b44a-4270-8f56-d2d38c16fd91',true);
ASSERT NOT public.owns_cancellation_debt('73d61f2f-b369-41f3-8915-8e6de52d6378','767c51a7-7323-4933-8fc5-9a666f6baa7c','65b929ae-b44a-4270-8f56-d2d38c16fd91'), 'client cannot release';
PERFORM set_config('request.jwt.claim.sub',COALESCE(previous_sub,''),true);
END $$;