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
BEGIN
  SELECT * INTO v_agendamento
  FROM public.agendamentos
  WHERE id = p_agendamento_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT nome, telefone INTO v_cli
  FROM public.profiles
  WHERE id = v_agendamento.user_id;

  SELECT apelido, tenant_id INTO v_barb
  FROM public.barbeiros
  WHERE id = v_agendamento.barbeiro_id;

  SELECT nome, preco, tenant_id INTO v_srv
  FROM public.servicos
  WHERE id = v_agendamento.servico_id;

  v_tenant_id := COALESCE(v_barb.tenant_id, v_srv.tenant_id);
  v_phone_whatsapp := public.format_phone_for_whatsapp(v_cli.telefone);

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
    CASE WHEN lower(unaccent(COALESCE(b.apelido, ''))) LIKE '%tulio%' THEN 0 ELSE 1 END,
    wi.connected_at ASC NULLS LAST,
    wi.created_at ASC NULLS LAST
  LIMIT 1;

  SELECT
    webhook_url,
    ativo,
    confirmacao_webhook_url,
    confirmacao_ativo,
    lembrete_webhook_url,
    lembrete_ativo
  INTO v_cfg
  FROM public.webhook_config
  ORDER BY updated_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  IF p_kind = 'agendamento_confirmado'
     AND COALESCE(v_cfg.confirmacao_ativo, false) = true
     AND NULLIF(v_cfg.confirmacao_webhook_url, '') IS NOT NULL THEN
    v_webhook_url := v_cfg.confirmacao_webhook_url;
    v_webhook_type := 'confirmation';
  ELSIF (p_kind ILIKE 'reminder_%' OR p_kind ILIKE '%lembrete%')
     AND COALESCE(v_cfg.lembrete_ativo, false) = true
     AND NULLIF(v_cfg.lembrete_webhook_url, '') IS NOT NULL THEN
    v_webhook_url := v_cfg.lembrete_webhook_url;
    v_webhook_type := 'reminder';
  ELSIF COALESCE(v_cfg.ativo, false) = true
     AND NULLIF(v_cfg.webhook_url, '') IS NOT NULL THEN
    v_webhook_url := v_cfg.webhook_url;
    v_webhook_type := 'generic';
  END IF;

  IF NULLIF(v_phone_whatsapp, '') IS NULL THEN
    INSERT INTO public.agendamento_lembretes_log (
      agendamento_id, user_id, kind, channel, scheduled_for, status, details
    ) VALUES (
      v_agendamento.id,
      v_agendamento.user_id,
      p_kind,
      'webhook',
      now(),
      'error',
      jsonb_build_object(
        'reason', 'missing_client_phone',
        'cliente_nome', v_cli.nome,
        'cliente_telefone', v_cli.telefone,
        'barbeiro_id', v_agendamento.barbeiro_id,
        'servico_id', v_agendamento.servico_id,
        'tenant_id', v_tenant_id
      )
    );
    RETURN NULL;
  END IF;

  IF v_whatsapp_inst.instance_name IS NULL THEN
    INSERT INTO public.agendamento_lembretes_log (
      agendamento_id, user_id, kind, channel, scheduled_for, status, details
    ) VALUES (
      v_agendamento.id,
      v_agendamento.user_id,
      p_kind,
      'webhook',
      now(),
      'error',
      jsonb_build_object(
        'reason', 'missing_connected_whatsapp_instance',
        'barbeiro_id', v_agendamento.barbeiro_id,
        'servico_id', v_agendamento.servico_id,
        'tenant_id', v_tenant_id,
        'cliente_telefone_whatsapp', v_phone_whatsapp
      )
    );
    RETURN NULL;
  END IF;

  IF v_webhook_url IS NULL THEN
    INSERT INTO public.agendamento_lembretes_log (
      agendamento_id, user_id, kind, channel, scheduled_for, status, details
    ) VALUES (
      v_agendamento.id,
      v_agendamento.user_id,
      p_kind,
      'webhook',
      now(),
      'error',
      jsonb_build_object(
        'reason', 'missing_active_webhook_url',
        'webhook_type', v_webhook_type,
        'barbeiro_id', v_agendamento.barbeiro_id,
        'servico_id', v_agendamento.servico_id,
        'tenant_id', v_tenant_id,
        'whatsapp_instance_name', v_whatsapp_inst.instance_name,
        'cliente_telefone_whatsapp', v_phone_whatsapp
      )
    );
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := v_webhook_url,
    body := jsonb_build_object(
      'evento', p_kind,
      'agendamento_id', v_agendamento.id,
      'timestamp', now(),
      'tenant_id', v_tenant_id,
      'webhook_type', v_webhook_type,
      'data', v_agendamento.data,
      'hora', to_char(v_agendamento.hora, 'HH24:MI'),
      'duracao_minutos', v_agendamento.duracao,
      'status', v_agendamento.status::text,
      'tipo_agendamento', v_agendamento.tipo_agendamento,
      'payment_method', v_agendamento.payment_method,
      'preco', v_agendamento.preco,
      'servico', jsonb_build_object(
        'id', v_agendamento.servico_id,
        'nome', v_srv.nome,
        'preco_cadastro', v_srv.preco
      ),
      'barbeiro', jsonb_build_object(
        'id', v_agendamento.barbeiro_id,
        'nome', v_barb.apelido
      ),
      'whatsapp_instance', jsonb_build_object(
        'barbeiro_id', v_whatsapp_inst.barbeiro_id,
        'barbeiro_nome', v_whatsapp_inst.barbeiro_nome,
        'instance_name', v_whatsapp_inst.instance_name,
        'api_key', v_whatsapp_inst.api_key,
        'status', v_whatsapp_inst.status
      ),
      'contatos', jsonb_build_array(
        jsonb_build_object(
          'cliente_id', v_agendamento.user_id,
          'cliente_nome', v_cli.nome,
          'cliente_telefone', v_cli.telefone,
          'cliente_telefone_whatsapp', v_phone_whatsapp,
          'mensagem', p_msg
        )
      )
    ),
    headers := '{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds := 15000
  ) INTO v_request_id;

  INSERT INTO public.agendamento_lembretes_log (
    agendamento_id,
    user_id,
    kind,
    channel,
    scheduled_for,
    status,
    details
  ) VALUES (
    v_agendamento.id,
    v_agendamento.user_id,
    p_kind,
    'webhook',
    now(),
    'queued',
    jsonb_build_object(
      'net_request_id', v_request_id,
      'webhook_type', v_webhook_type,
      'webhook_url_used', v_webhook_url,
      'whatsapp_instance_name', v_whatsapp_inst.instance_name,
      'whatsapp_instance_barbeiro_id', v_whatsapp_inst.barbeiro_id,
      'whatsapp_instance_barbeiro_nome', v_whatsapp_inst.barbeiro_nome,
      'cliente_telefone_whatsapp', v_phone_whatsapp,
      'cliente_nome', v_cli.nome,
      'barbeiro_id', v_agendamento.barbeiro_id,
      'barbeiro_nome', v_barb.apelido,
      'servico_id', v_agendamento.servico_id,
      'servico_nome', v_srv.nome,
      'tenant_id', v_tenant_id,
      'preco_enviado', v_agendamento.preco,
      'status_observacao', 'queued_pg_net_check_net_http_response'
    )
  );

  RETURN v_request_id;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.agendamento_lembretes_log (
    agendamento_id, user_id, kind, channel, scheduled_for, status, details
  ) VALUES (
    p_agendamento_id,
    COALESCE(v_agendamento.user_id, NULL),
    p_kind,
    'webhook',
    now(),
    'error',
    jsonb_build_object(
      'reason', 'send_helper_exception',
      'error', SQLERRM,
      'tenant_id', v_tenant_id
    )
  );
  RETURN NULL;
END;
$function$;