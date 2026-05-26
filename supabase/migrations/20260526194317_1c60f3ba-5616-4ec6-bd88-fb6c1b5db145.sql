-- 1. Padronizar a função principal de envio com payload rico e compatível
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
BEGIN
  -- 1. Carregar dados básicos
  SELECT * INTO v_agendamento FROM public.agendamentos WHERE id = p_agendamento_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT nome, telefone, cpf, email INTO v_cli FROM public.profiles WHERE id = v_agendamento.user_id;
  SELECT apelido, tenant_id INTO v_barb FROM public.barbeiros WHERE id = v_agendamento.barbeiro_id;
  SELECT nome, preco, tenant_id INTO v_srv FROM public.servicos WHERE id = v_agendamento.servico_id;

  v_tenant_id := COALESCE(v_barb.tenant_id, v_srv.tenant_id);
  v_phone_whatsapp := public.format_phone_for_whatsapp(v_cli.telefone);

  -- 2. Resolver Instância WhatsApp (Prioridade: Barbeiro -> Tulio -> Qualquer conectada)
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

  -- 3. Resolver Webhook URL baseado no Kind
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
    v_webhook_type := 'generic';
  END IF;

  -- 4. Validações básicas antes de enviar
  IF NULLIF(v_phone_whatsapp, '') IS NULL OR v_whatsapp_inst.instance_name IS NULL OR v_webhook_url IS NULL THEN
    INSERT INTO public.agendamento_lembretes_log (agendamento_id, user_id, kind, channel, status, details)
    VALUES (p_agendamento_id, v_agendamento.user_id, p_kind, 'webhook', 'error', 
      jsonb_build_object(
        'reason', CASE 
          WHEN v_phone_whatsapp IS NULL THEN 'missing_phone' 
          WHEN v_whatsapp_inst.instance_name IS NULL THEN 'missing_instance' 
          ELSE 'missing_webhook' END,
        'tenant_id', v_tenant_id
      ));
    RETURN NULL;
  END IF;

  -- 5. Montar Payload RICO (Compatível com n8n/Evolution)
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
        'cliente_id', v_agendamento.user_id,
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
      'source', 'postgres_trigger'
    )
  );

  -- 6. Disparar Webhook
  SELECT net.http_post(
    url := v_webhook_url,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := v_payload,
    timeout_milliseconds := 15000
  ) INTO v_request_id;

  -- 7. Registrar Log
  INSERT INTO public.agendamento_lembretes_log (
    agendamento_id, user_id, kind, channel, status, details
  ) VALUES (
    p_agendamento_id, v_agendamento.user_id, p_kind, 'webhook', 'queued',
    jsonb_build_object(
      'net_request_id', v_request_id,
      'webhook_url', v_webhook_url,
      'webhook_type', v_webhook_type,
      'instance_name', v_whatsapp_inst.instance_name,
      'cliente_nome', v_cli.nome
    )
  );

  RETURN v_request_id;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.agendamento_lembretes_log (agendamento_id, user_id, kind, channel, status, details)
  VALUES (p_agendamento_id, NULL, p_kind, 'webhook', 'error', jsonb_build_object('error', SQLERRM));
  RETURN NULL;
END;
$function$;

-- 2. Refinar Gatilho de Novo Agendamento
CREATE OR REPLACE FUNCTION public.trg_notify_new_appointment_whatsapp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_msg text;
  v_nome_cli text;
BEGIN
  -- Se for INSERT e ainda não estiver confirmado (se já estiver confirmado no insert, o outro trigger cuida)
  IF TG_OP = 'INSERT' AND COALESCE(NEW.barbeiro_confirmou, false) = false THEN
    SELECT split_part(COALESCE(nome, 'Cliente'), ' ', 1) INTO v_nome_cli FROM public.profiles WHERE id = NEW.user_id;
    
    v_msg := '📋 *Novo agendamento recebido!*' || E'\n\n' ||
             'Olá ' || v_nome_cli || '! Recebemos seu pedido para o dia ' || to_char(NEW.data, 'DD/MM') || 
             ' às ' || to_char(NEW.hora, 'HH24:MI') || '.' || E'\n\n' ||
             'Aguarde a confirmação do barbeiro. 🔔';
             
    PERFORM public.send_agendamento_whatsapp_webhook(NEW.id, 'novo_agendamento', v_msg);
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. Refinar Gatilho de Confirmação
CREATE OR REPLACE FUNCTION public.trg_send_confirm_message_on_barber_confirm()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_msg text;
  v_nome_cli text;
  v_barbeiro_nome text;
BEGIN
  -- Dispara se: status mudou para confirmed OU se foi inserido já como confirmed
  IF (TG_OP = 'UPDATE' AND NEW.status = 'confirmed' AND OLD.status <> 'confirmed') OR
     (TG_OP = 'INSERT' AND NEW.status = 'confirmed') THEN
     
    SELECT split_part(COALESCE(nome, 'Cliente'), ' ', 1) INTO v_nome_cli FROM public.profiles WHERE id = NEW.user_id;
    SELECT apelido INTO v_barbeiro_nome FROM public.barbeiros WHERE id = NEW.barbeiro_id;

    v_msg := '✅ *Agendamento Confirmado!*' || E'\n\n' ||
             'Olá ' || v_nome_cli || '! Seu horário com ' || COALESCE(v_barbeiro_nome, 'o barbeiro') || 
             ' para o dia ' || to_char(NEW.data, 'DD/MM') || ' às ' || to_char(NEW.hora, 'HH24:MI') || 
             ' está confirmado.' || E'\n\n' ||
             'Nos vemos em breve! 💈';

    PERFORM public.send_agendamento_whatsapp_webhook(NEW.id, 'agendamento_confirmado', v_msg);
  END IF;
  RETURN NEW;
END;
$function$;

-- 4. Criar Gatilho de Cancelamento (A Varredura por completo!)
CREATE OR REPLACE FUNCTION public.trg_notify_appointment_cancelled_whatsapp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_msg text;
  v_nome_cli text;
BEGIN
  -- Se o status mudou para cancelado
  IF NEW.status IN ('cancelled_by_user', 'cancelled_by_admin') AND OLD.status NOT IN ('cancelled_by_user', 'cancelled_by_admin') THEN
    SELECT split_part(COALESCE(nome, 'Cliente'), ' ', 1) INTO v_nome_cli FROM public.profiles WHERE id = NEW.user_id;
    
    v_msg := '❌ *Agendamento Cancelado*' || E'\n\n' ||
             'Olá ' || v_nome_cli || ', seu agendamento para o dia ' || to_char(NEW.data, 'DD/MM') || 
             ' às ' || to_char(NEW.hora, 'HH24:MI') || ' foi cancelado.' || E'\n\n' ||
             'Se desejar, você pode agendar um novo horário pelo nosso app! 📱';

    PERFORM public.send_agendamento_whatsapp_webhook(NEW.id, 'agendamento_cancelado', v_msg);
  END IF;
  RETURN NEW;
END;
$function$;

-- Garantir que o trigger de cancelamento exista
DROP TRIGGER IF EXISTS trg_notify_appointment_cancelled_whatsapp ON public.agendamentos;
CREATE TRIGGER trg_notify_appointment_cancelled_whatsapp
AFTER UPDATE OF status ON public.agendamentos
FOR EACH ROW EXECUTE FUNCTION trg_notify_appointment_cancelled_whatsapp();
