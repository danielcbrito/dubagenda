CREATE OR REPLACE FUNCTION public.settle_cancellation_debt(p_correlation text,p_cents integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE w public.woovi_charges%ROWTYPE; d public.informacoes_empresa%ROWTYPE; j jsonb; BEGIN
SELECT * INTO w FROM public.woovi_charges WHERE correlation_id=p_correlation FOR UPDATE; IF NOT FOUND OR w.metadata->>'purpose' IS DISTINCT FROM 'cancellation_debt' THEN RAISE EXCEPTION 'UNKNOWN_DEBT_CHARGE'; END IF;
IF p_cents IS NULL OR p_cents<=0 OR w.value_centavos IS DISTINCT FROM p_cents THEN RAISE EXCEPTION 'VALUE_MISMATCH'; END IF;
SELECT * INTO d FROM public.informacoes_empresa WHERE tenant_id=(w.metadata->>'tenant_id')::uuid AND chave='debito_cancelamento_'||w.user_id AND categoria='debitos_cliente' FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'DEBT_NOT_FOUND'; END IF; j:=d.valor::jsonb;
IF j->>'id' IS DISTINCT FROM w.metadata->>'debt_id' OR j->>'cliente_id' IS DISTINCT FROM w.user_id::text OR j->>'barbeiro_id' IS DISTINCT FROM w.barbeiro_id::text OR round((j->>'valor_taxa')::numeric*100)::integer IS DISTINCT FROM p_cents THEN RAISE EXCEPTION 'DEBT_MISMATCH'; END IF;
IF j->>'status'='pago' THEN RETURN jsonb_build_object('success',true,'duplicate',true); END IF;
IF j->>'status' IS DISTINCT FROM 'pendente' THEN RAISE EXCEPTION 'INVALID_DEBT_STATUS'; END IF;
UPDATE public.informacoes_empresa SET valor=(j||jsonb_build_object('status','pago','paid_at',now(),'correlation_id',p_correlation))::text,atualizado_em=now() WHERE id=d.id;
UPDATE public.woovi_charges SET status='COMPLETED',paid_at=COALESCE(paid_at,now()),updated_at=now() WHERE id=w.id;
RETURN jsonb_build_object('success',true); END $$;
REVOKE ALL ON FUNCTION public.settle_cancellation_debt(text,integer) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.settle_cancellation_debt(text,integer) TO service_role;
DO $$ BEGIN
IF public.cancellation_fee_amount('{"habilitado":true,"tipo":"porcentagem","valor":20,"horas_antecedencia":0}',50,'2026-10-20 15:00Z','2026-10-18 15:00Z') IS DISTINCT FROM 10 THEN RAISE EXCEPTION 'TEST_PERCENTAGE'; END IF;
IF public.cancellation_fee_amount('{"habilitado":true,"tipo":"fixo","valor":15}',50,now(),now()) IS DISTINCT FROM 15 THEN RAISE EXCEPTION 'TEST_FIXED'; END IF;
IF public.cancellation_fee_amount('{"habilitado":false}',50,now(),now()) IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'TEST_DISABLED'; END IF;
IF public.cancellation_fee_amount('{"habilitado":true,"valor":20,"horas_antecedencia":2}',50,'2026-10-20 15:00Z','2026-10-20 12:00Z') IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'TEST_WINDOW'; END IF;
END $$;