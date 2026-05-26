-- 1. Remover gatilhos duplicados
DROP TRIGGER IF EXISTS log_appointment_changes ON public.agendamentos;
DROP TRIGGER IF EXISTS set_cancelado_em_trigger ON public.agendamentos;
DROP TRIGGER IF EXISTS trg_enforce_barbeiro_id_required_agendamentos ON public.agendamentos;

-- 2. Atualizar função de webhook com melhor rastreamento
CREATE OR REPLACE FUNCTION public.send_agendamento_whatsapp_webhook(p_agendamento_id uuid, p_kind text, p_msg text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_agendamento RECORD;
  v_cfg RECORD;
  v_cli RECORD;
  v_barb RECORD;
  v_srv RECORD;
  v_whatsapp_inst RECORD;
  v_request_id BIGINT;
  v_tenant_id UUID;
  v_webhook_url TEXT;
  v_webhook_type TEXT := 'generic';
  v_phone_whatsapp TEXT;
  v_payload JSONB;
  v_user_id UUID;
BEGIN
  -- 1. Carregar agendamento
  SELECT * INTO v_agendamento FROM public.agendamentos WHERE id = p_agendamento_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_user_id := v_agendamento.user_id;

  -- 2. Carregar dependências
  SELECT nome, telefone, cpf, email INTO v_cli FROM public.profiles WHERE id = v_user_id;
  SELECT apelido, tenant_id INTO v_barb FROM public.barbeiros WHERE id = v_agendamento.barbeiro_id;
  SELECT nome, preco, tenant_id INTO v_srv FROM public.servicos WHERE id = v_agendamento.servico_id;

  v_tenant_id := COALESCE(v_barb.tenant_id, v_srv.tenant_id);
  v_phone_whatsapp := public.format_phone_for_whatsapp(v_cli.telefone);

  -- 3. Resolver Instância WhatsApp
  SELECT wi.instance_name, wi.api_key, wi.status, wi.barbeiro_id, b.apelido AS barbeiro_nome
  INTO v_whatsapp_inst
  FROM public.whatsapp_instances wi
  JOIN public.barbeiros b ON b.id = wi.barbeiro_id
  WHERE b.tenant_id = v_tenant_id
    AND wi.status = 'connected'
    AND wi.instance_name IS NOT NULL
    AND wi.api_key IS NOT NULL
  ORDER BY
    CASE WHEN wi.barbeiro_id = v_agendamento.barbeiro_id THEN 0 ELSE 1 END,
    CASE WHEN lower(COALESCE(b.apelido, '')) LIKE '%tulio%' THEN 0 ELSE 1 END,
    wi.connected_at DESC NULLS LAST
  LIMIT 1;

  -- 4. Resolver Webhook URL (Prioriza Principal se configurado)
  SELECT * INTO v_cfg FROM public.webhook_config ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 1;

  IF p_kind = 'agendamento_confirmado' AND COALESCE(v_cfg.confirmacao_ativo, false) AND v_cfg.confirmacao_webhook_url <> '' THEN
    v_webhook_url := v_cfg.confirmacao_webhook_url;
    v_webhook_type := 'confirmation';
  ELSIF (p_kind ILIKE '%lembrete%' OR p_kind ILIKE 'reminder_%') AND COALESCE(v_cfg.lembrete_ativo, false) AND v_cfg.lembrete_webhook_url <> '' THEN
    v_webhook_url := v_cfg.lembrete_webhook_url;
    v_webhook_type := 'reminder';
  ELSIF COALESCE(v_cfg.whatsapp_ativo, false) AND v_cfg.whatsapp_webhook_url <> '' THEN
    v_webhook_url := v_cfg.whatsapp_webhook_url;
    v_webhook_type := 'whatsapp_dedicated';
  ELSIF COALESCE(v_cfg.ativo, false) AND v_cfg.webhook_url <> '' THEN
    v_webhook_url := v_cfg.webhook_url;
    v_webhook_type := 'generic_main';
  END IF;

  -- 5. Validações
  IF NULLIF(v_phone_whatsapp, '') IS NULL OR v_whatsapp_inst.instance_name IS NULL OR v_webhook_url IS NULL THEN
    BEGIN
      INSERT INTO public.agendamento_lembretes_log (agendamento_id, user_id, kind, channel, status, details)
      VALUES (p_agendamento_id, v_user_id, p_kind, 'webhook', 'error',
        jsonb_build_object(
          'reason', CASE
            WHEN v_phone_whatsapp IS NULL THEN 'missing_phone'
            WHEN v_whatsapp_inst.instance_name IS NULL THEN 'missing_instance'
            ELSE 'missing_webhook' END,
          'tenant_id', v_tenant_id,
          'webhook_url_tried', v_webhook_url
        ));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    RETURN NULL;
  END IF;

  -- 6. Payload
  v_payload := jsonb_build_object(
    'evento', p_kind,
    'timestamp', now(),
    'agendamento_id', v_agendamento.id,
    'whatsapp_instance', jsonb_build_object(
      'instance_name', v_whatsapp_inst.instance_name,
      'api_key', v_whatsapp_inst.api_key,
      'barbeiro_nome', v_whatsapp_inst.barbeiro_nome
    ),
    'contatos', jsonb_build_array(
      jsonb_build_object(
        'cliente_id', v_user_id,
        'cliente_nome', v_cli.nome,
        'cliente_telefone', v_cli.telefone,
        'cliente_telefone_whatsapp', v_phone_whatsapp,
        'mensagem', p_msg
      )
    ),
    'agendamento', jsonb_build_object(
      'data', v_agendamento.data,
      'hora', v_agendamento.hora,
      'servico', v_srv.nome,
      'barbeiro', v_barb.apelido,
      'preco', v_agendamento.preco,
      'status', v_agendamento.status
    ),
    'metadata', jsonb_build_object(
      'webhook_type', v_webhook_type,
      'tenant_id', v_tenant_id,
      'source', 'postgres_trigger_v2'
    )
  );

  -- 7. Execução protegida
  BEGIN
    SELECT net.http_post(
      url := v_webhook_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := v_payload,
      timeout_milliseconds := 15000
    ) INTO v_request_id;

    INSERT INTO public.agendamento_lembretes_log (
      agendamento_id, user_id, kind, channel, status, details
    ) VALUES (
      p_agendamento_id, v_user_id, p_kind, 'webhook', 'queued',
      jsonb_build_object(
        'net_request_id', v_request_id,
        'webhook_url', v_webhook_url,
        'webhook_type', v_webhook_type,
        'instance_name', v_whatsapp_inst.instance_name,
        'cliente_nome', v_cli.nome
      )
    );
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      INSERT INTO public.agendamento_lembretes_log (agendamento_id, user_id, kind, channel, status, details)
      VALUES (p_agendamento_id, v_user_id, p_kind, 'webhook', 'error', 
        jsonb_build_object(
          'error', SQLERRM, 
          'webhook_url', v_webhook_url,
          'phase', 'http_post'
        ));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    RETURN NULL;
  END;

  RETURN v_request_id;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    INSERT INTO public.agendamento_lembretes_log (agendamento_id, user_id, kind, channel, status, details)
    VALUES (p_agendamento_id, v_user_id, p_kind, 'webhook', 'error', 
      jsonb_build_object(
        'error', SQLERRM, 
        'phase', 'global_fallback'
      ));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NULL;
END;
$function$;
