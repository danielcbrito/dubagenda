-- 1. Update the main webhook function to include 'mensagem' at the root of the payload
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
  v_webhook_type TEXT := 'generic_main';
  v_phone_whatsapp TEXT;
  v_payload JSONB;
  v_user_id UUID;
  v_missing_reason TEXT;
BEGIN
  SELECT * INTO v_agendamento
  FROM public.agendamentos
  WHERE id = p_agendamento_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_user_id := v_agendamento.user_id;

  SELECT nome, telefone, cpf
    INTO v_cli
    FROM public.profiles
   WHERE id = v_user_id;

  SELECT apelido, tenant_id
    INTO v_barb
    FROM public.barbeiros
   WHERE id = v_agendamento.barbeiro_id;

  SELECT nome, preco, tenant_id
    INTO v_srv
    FROM public.servicos
   WHERE id = v_agendamento.servico_id;

  v_tenant_id := COALESCE(v_barb.tenant_id, v_srv.tenant_id);
  v_phone_whatsapp := public.format_phone_for_whatsapp(v_cli.telefone);

  SELECT wi.instance_name, wi.api_key, wi.status, wi.barbeiro_id, b.apelido AS barbeiro_nome
    INTO v_whatsapp_inst
    FROM public.whatsapp_instances wi
    LEFT JOIN public.barbeiros b ON b.id = wi.barbeiro_id
   WHERE (b.tenant_id = v_tenant_id OR v_tenant_id IS NULL OR v_tenant_id = '73d61f2f-b369-41f3-8915-8e6de52d6378')
     AND wi.status = 'connected'
     AND wi.instance_name IS NOT NULL
     AND wi.api_key IS NOT NULL
   ORDER BY
     CASE WHEN wi.barbeiro_id = v_agendamento.barbeiro_id THEN 0 ELSE 1 END,
     CASE WHEN b.tenant_id = v_tenant_id THEN 0 ELSE 1 END,
     wi.connected_at DESC NULLS LAST
   LIMIT 1;

  SELECT * INTO v_cfg
  FROM public.webhook_config
  ORDER BY updated_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  IF COALESCE(v_cfg.ativo, false) AND NULLIF(v_cfg.webhook_url, '') IS NOT NULL THEN
    v_webhook_url := v_cfg.webhook_url;
    v_webhook_type := 'generic_main';
  ELSIF p_kind = 'agendamento_confirmado'
     AND COALESCE(v_cfg.confirmacao_ativo, false)
     AND NULLIF(v_cfg.confirmacao_webhook_url, '') IS NOT NULL THEN
    v_webhook_url := v_cfg.confirmacao_webhook_url;
    v_webhook_type := 'confirmation_fallback';
  ELSIF (p_kind ILIKE '%lembrete%' OR p_kind ILIKE 'reminder_%')
     AND COALESCE(v_cfg.lembrete_ativo, false)
     AND NULLIF(v_cfg.lembrete_webhook_url, '') IS NOT NULL THEN
    v_webhook_url := v_cfg.lembrete_webhook_url;
    v_webhook_type := 'reminder';
  ELSIF COALESCE(v_cfg.whatsapp_ativo, false)
     AND NULLIF(v_cfg.whatsapp_webhook_url, '') IS NOT NULL THEN
    v_webhook_url := v_cfg.whatsapp_webhook_url;
    v_webhook_type := 'whatsapp_dedicated_fallback';
  END IF;

  IF NULLIF(v_phone_whatsapp, '') IS NULL OR v_whatsapp_inst.instance_name IS NULL OR v_webhook_url IS NULL THEN
    v_missing_reason := CASE
      WHEN NULLIF(v_phone_whatsapp, '') IS NULL THEN 'missing_phone'
      WHEN v_whatsapp_inst.instance_name IS NULL THEN 'missing_instance'
      ELSE 'missing_webhook'
    END;

    BEGIN
      INSERT INTO public.agendamento_lembretes_log (
        agendamento_id, user_id, kind, scheduled_for, channel, status, details
      ) VALUES (
        p_agendamento_id, v_user_id, p_kind, now(), 'webhook', 'error',
        jsonb_build_object(
          'reason', v_missing_reason,
          'tenant_id', v_tenant_id,
          'webhook_url_tried', v_webhook_url,
          'phase', 'validation_v5_final'
        )
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    RETURN NULL;
  END IF;

  -- ENHANCEMENT: Added 'mensagem' at root level to avoid duplicates in Edge Function
  v_payload := jsonb_build_object(
    'evento', p_kind,
    'timestamp', now(),
    'agendamento_id', v_agendamento.id,
    'mensagem', p_msg, -- Root level message
    'whatsapp_instance', jsonb_build_object(
      'instance_name', v_whatsapp_inst.instance_name,
      'api_key', v_whatsapp_inst.api_key,
      'barbeiro_id', v_whatsapp_inst.barbeiro_id,
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
      'source', 'postgres_trigger_v5'
    )
  );

  BEGIN
    SELECT net.http_post(
      url := v_webhook_url,
      body := v_payload,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 7000
    ) INTO v_request_id;

    INSERT INTO public.agendamento_lembretes_log (
      agendamento_id, user_id, kind, scheduled_for, channel, status, details
    ) VALUES (
      p_agendamento_id, v_user_id, p_kind, now(), 'webhook', 'sent', 
      jsonb_build_object(
        'net_request_id', v_request_id,
        'webhook_url_used', v_webhook_url,
        'webhook_type', v_webhook_type,
        'whatsapp_instance_name', v_whatsapp_inst.instance_name,
        'cliente_nome', v_cli.nome,
        'mensagem_sent', p_msg
      ));

    RETURN v_request_id;
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      INSERT INTO public.agendamento_lembretes_log (
        agendamento_id, user_id, kind, scheduled_for, channel, status, details
      ) VALUES (
        p_agendamento_id, v_user_id, p_kind, now(), 'webhook', 'error', 
        jsonb_build_object(
          'error', SQLERRM, 
          'phase', 'http_post_attempt',
          'webhook_url', v_webhook_url
        ));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    RETURN NULL;
  END;
END;
$function$;

-- 2. Update Cancellation Trigger (Single Newline)
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
    
    -- Changed \n\n to \n to avoid split messages
    v_msg := '❌ *Agendamento Cancelado*' || E'\n' ||
             'Olá ' || v_nome_cli || ', seu agendamento para o dia ' || to_char(NEW.data, 'DD/MM') || 
             ' às ' || to_char(NEW.hora, 'HH24:MI') || ' foi cancelado.' || E'\n' ||
             'Se desejar, você pode agendar um novo horário pelo nosso app! 📱';

    PERFORM public.send_agendamento_whatsapp_webhook(NEW.id, 'agendamento_cancelado', v_msg);
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. Update New Appointment Trigger (Single Newline)
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
  BEGIN
    -- Se for INSERT e ainda não estiver confirmado
    IF TG_OP = 'INSERT' AND COALESCE(NEW.barbeiro_confirmou, false) = false THEN
      SELECT split_part(COALESCE(nome, 'Cliente'), ' ', 1) INTO v_nome_cli FROM public.profiles WHERE id = NEW.user_id;
      
      -- Changed \n\n to \n to avoid split messages
      v_msg := '📋 *Novo agendamento recebido!*' || E'\n' ||
               'Olá ' || v_nome_cli || '! Recebemos seu pedido para o dia ' || to_char(NEW.data, 'DD/MM') || 
               ' às ' || to_char(NEW.hora, 'HH24:MI') || '.' || E'\n' ||
               'Aguarde a confirmação do barbeiro. 🔔';
               
      PERFORM public.send_agendamento_whatsapp_webhook(NEW.id, 'novo_agendamento', v_msg);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'trg_notify_new_appointment_whatsapp falhou: %', SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

-- 4. Update Confirmation Trigger (Single Newline)
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
  BEGIN
    IF (TG_OP = 'UPDATE' AND NEW.status = 'confirmed' AND OLD.status <> 'confirmed') OR
       (TG_OP = 'INSERT' AND NEW.status = 'confirmed') THEN
       
      SELECT split_part(COALESCE(nome, 'Cliente'), ' ', 1) INTO v_nome_cli FROM public.profiles WHERE id = NEW.user_id;
      SELECT apelido INTO v_barbeiro_nome FROM public.barbeiros WHERE id = NEW.barbeiro_id;

      -- Changed \n\n to \n to avoid split messages
      v_msg := '✅ *Agendamento Confirmado!*' || E'\n' ||
               'Olá ' || v_nome_cli || '! Seu horário com ' || COALESCE(v_barbeiro_nome, 'o barbeiro') || 
               ' para o dia ' || to_char(NEW.data, 'DD/MM') || ' às ' || to_char(NEW.hora, 'HH24:MI') || 
               ' está confirmado.' || E'\n' ||
               'Nos vemos em breve! 💈';

      PERFORM public.send_agendamento_whatsapp_webhook(NEW.id, 'agendamento_confirmado', v_msg);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'trg_send_confirm_message_on_barber_confirm falhou: %', SQLERRM;
  END;
  RETURN NEW;
END;
$function$;
