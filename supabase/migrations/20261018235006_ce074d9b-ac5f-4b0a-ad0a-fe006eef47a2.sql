CREATE OR REPLACE FUNCTION public.record_client_cancellation_debt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE q jsonb; fee numeric; existing public.informacoes_empresa%ROWTYPE; debt jsonb; t uuid; client_name text; client_phone text;
BEGIN
IF NEW.status<>'cancelled_by_user' OR OLD.status NOT IN ('pending','confirmed') OR NEW.user_id IS NULL THEN RETURN NEW; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended('cancel-debt:'||NEW.user_id::text,0));
q:=public.quote_client_cancellation(NEW.id,NEW.user_id); fee:=(q->>'valor_taxa')::numeric; t:=(q->>'tenant_id')::uuid;
IF fee<=0 THEN RETURN NEW; END IF;
SELECT * INTO existing FROM public.informacoes_empresa WHERE tenant_id=t AND categoria='debitos_cliente' AND chave='debito_cancelamento_'||NEW.user_id FOR UPDATE;
IF existing.id IS NOT NULL AND existing.valor::jsonb->>'status'='pendente' THEN RAISE EXCEPTION 'PENDING_CANCELLATION_DEBT'; END IF;
SELECT nome,telefone INTO client_name,client_phone FROM public.profiles WHERE id=NEW.user_id;
debt:=jsonb_build_object('id',gen_random_uuid(),'cliente_id',NEW.user_id,'cliente_nome',COALESCE(client_name,''),'cliente_telefone',COALESCE(client_phone,''),'barbeiro_id',NEW.barbeiro_id,'agendamento_id',NEW.id,'valor_taxa',fee,'tipo_taxa',COALESCE(q->'config'->>'tipo','porcentagem'),'porcentagem_aplicada',CASE WHEN COALESCE(q->'config'->>'tipo','porcentagem')='porcentagem' THEN COALESCE((q->'config'->>'valor')::numeric,20) ELSE NULL END,'valor_servico_original',NEW.preco,'status','pendente','created_at',now(),'tenant_id',t);
IF existing.id IS NULL THEN INSERT INTO public.informacoes_empresa(tenant_id,chave,categoria,valor,ativo) VALUES(t,'debito_cancelamento_'||NEW.user_id,'debitos_cliente',debt::text,true);
ELSE UPDATE public.informacoes_empresa SET valor=debt::text,ativo=true,atualizado_em=now() WHERE id=existing.id; END IF;
RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION public.record_client_cancellation_debt() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_client_cancellation_debt() TO service_role;