CREATE OR REPLACE FUNCTION public.cancellation_fee_amount(p_config jsonb,p_price numeric,p_start timestamptz,p_now timestamptz) RETURNS numeric LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$ DECLARE v numeric; h numeric; BEGIN
IF p_config->'habilitado' IS DISTINCT FROM 'true'::jsonb THEN RETURN 0; END IF;
IF COALESCE(p_config->>'tipo','porcentagem') NOT IN ('porcentagem','fixo') THEN RAISE EXCEPTION 'INVALID_CANCELLATION_CONFIG'; END IF;
v:=COALESCE((p_config->>'valor')::numeric,20); h:=COALESCE((p_config->>'horas_antecedencia')::numeric,0);
IF v<0 OR h<0 OR (COALESCE(p_config->>'tipo','porcentagem')='porcentagem' AND v>100) THEN RAISE EXCEPTION 'INVALID_CANCELLATION_CONFIG'; END IF;
IF h>0 AND p_start-p_now>make_interval(secs=>(h*3600)::double precision) THEN RETURN 0; END IF;
RETURN round(CASE WHEN COALESCE(p_config->>'tipo','porcentagem')='fixo' THEN v ELSE greatest(COALESCE(p_price,0),0)*v/100 END,2); END $$;
REVOKE ALL ON FUNCTION public.cancellation_fee_amount(jsonb,numeric,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.cancellation_fee_amount(jsonb,numeric,timestamptz,timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.quote_client_cancellation(p_appointment uuid,p_user uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE a public.agendamentos%ROWTYPE; t uuid; c jsonb:='{}'; n integer; fee numeric; BEGIN
SELECT * INTO a FROM public.agendamentos WHERE id=p_appointment AND user_id=p_user; IF NOT FOUND THEN RAISE EXCEPTION 'APPOINTMENT_NOT_OWNED'; END IF;
SELECT tenant_id INTO t FROM public.barbeiros WHERE id=a.barbeiro_id; IF t IS NULL THEN RAISE EXCEPTION 'TENANT_REQUIRED'; END IF;
SELECT count(*) INTO n FROM public.informacoes_empresa WHERE tenant_id=t AND chave='taxa_cancelamento_'||a.barbeiro_id AND ativo=true; IF n>1 THEN RAISE EXCEPTION 'DUPLICATE_CANCELLATION_CONFIG'; END IF;
SELECT valor::jsonb INTO c FROM public.informacoes_empresa WHERE tenant_id=t AND chave='taxa_cancelamento_'||a.barbeiro_id AND ativo=true;
fee:=public.cancellation_fee_amount(COALESCE(c,'{}'),a.preco,(a.data+a.hora) AT TIME ZONE 'America/Sao_Paulo',now());
RETURN jsonb_build_object('valor_taxa',fee,'config',COALESCE(c,'{}'),'tenant_id',t,'valor_servico_original',a.preco); END $$;
REVOKE ALL ON FUNCTION public.quote_client_cancellation(uuid,uuid) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.quote_client_cancellation(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.record_client_cancellation_debt() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE q jsonb; fee numeric; existing public.informacoes_empresa%ROWTYPE; debt jsonb; t uuid; BEGIN
IF NEW.status<>'cancelled_by_user' OR OLD.status NOT IN ('pending','confirmed') OR NEW.user_id IS NULL THEN RETURN NEW; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended('cancel-debt:'||NEW.user_id::text,0));
q:=public.quote_client_cancellation(NEW.id,NEW.user_id); fee:=(q->>'valor_taxa')::numeric; t:=(q->>'tenant_id')::uuid;
IF fee<=0 THEN RETURN NEW; END IF;
SELECT * INTO existing FROM public.informacoes_empresa WHERE tenant_id=t AND categoria='debitos_cliente' AND chave='debito_cancelamento_'||NEW.user_id FOR UPDATE;
IF existing.id IS NOT NULL AND existing.valor::jsonb->>'status'='pendente' THEN RAISE EXCEPTION 'PENDING_CANCELLATION_DEBT'; END IF;
debt:=jsonb_build_object('id',gen_random_uuid(),'cliente_id',NEW.user_id,'barbeiro_id',NEW.barbeiro_id,'agendamento_id',NEW.id,'valor_taxa',fee,'tipo_taxa',COALESCE(q->'config'->>'tipo','porcentagem'),'porcentagem_aplicada',CASE WHEN COALESCE(q->'config'->>'tipo','porcentagem')='porcentagem' THEN COALESCE((q->'config'->>'valor')::numeric,20) ELSE NULL END,'valor_servico_original',NEW.preco,'status','pendente','created_at',now(),'tenant_id',t);
IF existing.id IS NULL THEN INSERT INTO public.informacoes_empresa(tenant_id,chave,categoria,valor,ativo) VALUES(t,'debito_cancelamento_'||NEW.user_id,'debitos_cliente',debt::text,true);
ELSE UPDATE public.informacoes_empresa SET valor=debt::text,ativo=true,atualizado_em=now() WHERE id=existing.id; END IF;
RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.record_client_cancellation_debt() FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.record_client_cancellation_debt() TO service_role;
CREATE TRIGGER trg_record_client_cancellation_debt AFTER UPDATE OF status ON public.agendamentos FOR EACH ROW EXECUTE FUNCTION public.record_client_cancellation_debt();

CREATE POLICY cancellation_debt_private_read ON public.informacoes_empresa AS RESTRICTIVE FOR SELECT TO anon,authenticated USING ((categoria<>'debitos_cliente' AND chave NOT LIKE 'debito_cancelamento_%') OR (tenant_id IS NOT NULL AND (chave='debito_cancelamento_'||auth.uid()::text OR EXISTS(SELECT 1 FROM public.tenants t WHERE t.id=tenant_id AND t.owner_user_id=auth.uid()) OR public.has_role(auth.uid(),'ti'))));
CREATE POLICY cancellation_debt_owner_read ON public.informacoes_empresa FOR SELECT TO authenticated USING (tenant_id IS NOT NULL AND categoria='debitos_cliente' AND chave='debito_cancelamento_'||auth.uid()::text);
CREATE POLICY cancellation_debt_no_client_insert ON public.informacoes_empresa AS RESTRICTIVE FOR INSERT TO anon,authenticated WITH CHECK (categoria<>'debitos_cliente' AND chave NOT LIKE 'debito_cancelamento_%');
CREATE POLICY cancellation_debt_no_client_update ON public.informacoes_empresa AS RESTRICTIVE FOR UPDATE TO anon,authenticated USING (categoria<>'debitos_cliente' AND chave NOT LIKE 'debito_cancelamento_%') WITH CHECK (categoria<>'debitos_cliente' AND chave NOT LIKE 'debito_cancelamento_%');
CREATE POLICY cancellation_debt_no_client_delete ON public.informacoes_empresa AS RESTRICTIVE FOR DELETE TO anon,authenticated USING (categoria<>'debitos_cliente' AND chave NOT LIKE 'debito_cancelamento_%');

CREATE OR REPLACE FUNCTION public.get_my_cancellation_debts() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT COALESCE(jsonb_agg(jsonb_build_object('row_id',id,'tenant_id',tenant_id,'debito',valor::jsonb) ORDER BY atualizado_em), '[]'::jsonb) FROM public.informacoes_empresa WHERE tenant_id IS NOT NULL AND categoria='debitos_cliente' AND chave='debito_cancelamento_'||auth.uid()::text AND valor::jsonb->>'status'='pendente' $$;
REVOKE ALL ON FUNCTION public.get_my_cancellation_debts() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.get_my_cancellation_debts() TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_pending_cancellation_debt() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended('cancel-debt:'||NEW.user_id::text,0));
IF EXISTS(SELECT 1 FROM public.informacoes_empresa WHERE tenant_id IS NOT NULL AND categoria='debitos_cliente' AND chave='debito_cancelamento_'||NEW.user_id::text AND valor::jsonb->>'status'='pendente') THEN RAISE EXCEPTION 'PENDING_CANCELLATION_DEBT' USING ERRCODE='42501'; END IF;
RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.guard_pending_cancellation_debt() FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.guard_pending_cancellation_debt() TO service_role;
CREATE TRIGGER trg_guard_pending_cancellation_debt BEFORE INSERT ON public.agendamentos FOR EACH ROW EXECUTE FUNCTION public.guard_pending_cancellation_debt();
CREATE TRIGGER trg_guard_pending_cancellation_debt BEFORE INSERT ON public.pending_bookings FOR EACH ROW EXECUTE FUNCTION public.guard_pending_cancellation_debt();

CREATE OR REPLACE FUNCTION public.settle_cancellation_debt(p_correlation text,p_cents integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE w public.woovi_charges%ROWTYPE; d public.informacoes_empresa%ROWTYPE; j jsonb; BEGIN
SELECT * INTO w FROM public.woovi_charges WHERE correlation_id=p_correlation FOR UPDATE; IF NOT FOUND OR w.metadata->>'purpose'<>'cancellation_debt' THEN RAISE EXCEPTION 'UNKNOWN_DEBT_CHARGE'; END IF;
IF p_cents<=0 OR w.value_centavos IS DISTINCT FROM p_cents THEN RAISE EXCEPTION 'VALUE_MISMATCH'; END IF;
SELECT * INTO d FROM public.informacoes_empresa WHERE tenant_id=(w.metadata->>'tenant_id')::uuid AND chave='debito_cancelamento_'||w.user_id AND categoria='debitos_cliente' FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'DEBT_NOT_FOUND'; END IF; j:=d.valor::jsonb;
IF j->>'id' IS DISTINCT FROM w.metadata->>'debt_id' OR j->>'cliente_id' IS DISTINCT FROM w.user_id::text OR j->>'barbeiro_id' IS DISTINCT FROM w.barbeiro_id::text OR round((j->>'valor_taxa')::numeric*100)::integer<>p_cents THEN RAISE EXCEPTION 'DEBT_MISMATCH'; END IF;
IF j->>'status'='pago' THEN RETURN jsonb_build_object('success',true,'duplicate',true); END IF;
IF j->>'status'<>'pendente' THEN RAISE EXCEPTION 'INVALID_DEBT_STATUS'; END IF;
UPDATE public.informacoes_empresa SET valor=(j||jsonb_build_object('status','pago','paid_at',now(),'correlation_id',p_correlation))::text,atualizado_em=now() WHERE id=d.id;
UPDATE public.woovi_charges SET status='COMPLETED',paid_at=COALESCE(paid_at,now()),updated_at=now() WHERE id=w.id;
RETURN jsonb_build_object('success',true); END $$;
REVOKE ALL ON FUNCTION public.settle_cancellation_debt(text,integer) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.settle_cancellation_debt(text,integer) TO service_role;
ALTER TABLE public.informacoes_empresa REPLICA IDENTITY FULL;