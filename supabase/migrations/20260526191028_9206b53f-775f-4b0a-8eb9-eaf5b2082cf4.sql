-- 1. Helper function to send WhatsApp messages to avoid duplication and errors
CREATE OR REPLACE FUNCTION public.send_agendamento_whatsapp_webhook(
  p_agendamento_id UUID,
  p_kind TEXT, -- 'agendamento_confirmado' or 'novo_agendamento'
  p_msg TEXT
)
RETURNS BIGINT AS $$
DECLARE
  v_agendamento RECORD;
  v_cfg RECORD;
  v_cli RECORD;
  v_barb RECORD;
  v_whatsapp_inst RECORD;
  v_request_id BIGINT;
  v_tenant_id UUID;
BEGIN
  -- Buscar dados do agendamento
  SELECT * INTO v_agendamento FROM public.agendamentos WHERE id = p_agendamento_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Buscar dados do cliente
  SELECT nome, telefone INTO v_cli FROM public.profiles WHERE id = v_agendamento.user_id;

  -- Buscar dados do barbeiro e tenant
  SELECT apelido, tenant_id INTO v_barb FROM public.barbeiros WHERE id = v_agendamento.barbeiro_id;
  v_tenant_id := v_barb.tenant_id;

  -- Buscar instância do WhatsApp (prioridade para a do barbeiro, senão a do tenant)
  SELECT wi.instance_name, wi.api_key, wi.status
  INTO v_whatsapp_inst
  FROM public.whatsapp_instances wi
  WHERE (wi.barbeiro_id = v_agendamento.barbeiro_id OR wi.barbeiro_id IN (SELECT id FROM public.barbeiros WHERE tenant_id = v_tenant_id))
    AND wi.status = 'connected'
  ORDER BY (wi.barbeiro_id = v_agendamento.barbeiro_id) DESC, wi.updated_at DESC
  LIMIT 1;

  IF v_whatsapp_inst.instance_name IS NULL THEN
    RETURN NULL;
  END IF;

  -- Buscar configuração de webhook (pegar a mais recente e ativa)
  SELECT webhook_url, ativo INTO v_cfg 
  FROM public.webhook_config 
  WHERE ativo = true 
  ORDER BY updated_at DESC, created_at DESC 
  LIMIT 1;

  IF v_cfg.webhook_url IS NULL THEN
    RETURN NULL;
  END IF;

  -- Enviar para o webhook no formato esperado pelo N8N
  SELECT net.http_post(
    url := v_cfg.webhook_url,
    body := jsonb_build_object(
      'evento', p_kind,
      'agendamento_id', v_agendamento.id,
      'timestamp', now(),
      'whatsapp_instance', jsonb_build_object(
        'instance_name', v_whatsapp_inst.instance_name,
        'api_key', v_whatsapp_inst.api_key,
        'status', v_whatsapp_inst.status
      ),
      'tenant_id', v_tenant_id,
      'contatos', jsonb_build_array(
        jsonb_build_object(
          'cliente_nome', v_cli.nome,
          'cliente_telefone_whatsapp', public.format_phone_for_whatsapp(v_cli.telefone),
          'mensagem', p_msg
        )
      )
    ),
    headers := '{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds := 12000
  ) INTO v_request_id;

  -- Logar a tentativa
  INSERT INTO public.agendamento_lembretes_log (
    agendamento_id, 
    user_id, 
    kind, 
    channel, 
    scheduled_for, 
    status, 
    details
  )
  VALUES (
    v_agendamento.id, 
    v_agendamento.user_id, 
    p_kind, 
    'webhook', 
    now(), 
    'sent', 
    jsonb_build_object(
      'net_request_id', v_request_id,
      'whatsapp_instance_name', v_whatsapp_inst.instance_name,
      'webhook_url_used', v_cfg.webhook_url
    )
  );

  RETURN v_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update existing confirmation trigger function to use the helper
CREATE OR REPLACE FUNCTION public.trg_send_confirm_message_on_barber_confirm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  barb record;
  cli record;
  srv record;
  msg text;
  already_sent boolean;
  date_pretty text;
  price_line text;
  service_lines text := '';
  services_raw text;
  services_arr text[];
  s text;
  first_name text;
  template_conteudo text;
  template_ativo boolean;
  com_barbeiro text;
  has_free_token boolean;
  has_credits_token boolean;
  v_dow int;
  v_day int;
  v_month int;
BEGIN
  -- Verificar se deve disparar
  IF TG_OP = 'UPDATE' THEN
    IF COALESCE(OLD.barbeiro_confirmou, false) = true OR COALESCE(NEW.barbeiro_confirmou, false) <> true THEN
      RETURN NEW;
    END IF;
    IF NEW.status IS DISTINCT FROM 'confirmed'::appointment_status THEN RETURN NEW; END IF;
  ELSIF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.barbeiro_confirmou, false) <> true THEN RETURN NEW; END IF;
    IF NEW.status IS DISTINCT FROM 'confirmed'::appointment_status THEN RETURN NEW; END IF;
  ELSE
    RETURN NEW;
  END IF;

  -- Evitar duplicidade
  SELECT EXISTS (
    SELECT 1 FROM public.agendamento_lembretes_log
    WHERE agendamento_id = NEW.id AND kind = 'agendamento_confirmado' AND channel = 'webhook'
  ) INTO already_sent;
  IF already_sent THEN RETURN NEW; END IF;

  -- Carregar dados para a mensagem
  SELECT apelido INTO barb FROM public.barbeiros WHERE id = NEW.barbeiro_id;
  SELECT nome, telefone INTO cli FROM public.profiles WHERE id = NEW.user_id;
  SELECT nome INTO srv FROM public.servicos WHERE id = NEW.servico_id;
  first_name := split_part(COALESCE(cli.nome, 'Cliente'), ' ', 1);

  -- Formatar data
  v_dow := EXTRACT(DOW FROM NEW.data)::int;
  v_day := EXTRACT(DAY FROM NEW.data)::int;
  v_month := EXTRACT(MONTH FROM NEW.data)::int;
  date_pretty := CASE v_dow
    WHEN 0 THEN 'domingo' WHEN 1 THEN 'segunda-feira' WHEN 2 THEN 'terça-feira'
    WHEN 3 THEN 'quarta-feira' WHEN 4 THEN 'quinta-feira'
    WHEN 5 THEN 'sexta-feira' WHEN 6 THEN 'sábado' ELSE 'dia'
  END || ', ' || lpad(v_day::text, 2, '0') || ' de ' || CASE v_month
    WHEN 1 THEN 'janeiro' WHEN 2 THEN 'fevereiro' WHEN 3 THEN 'março'
    WHEN 4 THEN 'abril' WHEN 5 THEN 'maio' WHEN 6 THEN 'junho'
    WHEN 7 THEN 'julho' WHEN 8 THEN 'agosto' WHEN 9 THEN 'setembro'
    WHEN 10 THEN 'outubro' WHEN 11 THEN 'novembro' WHEN 12 THEN 'dezembro' ELSE 'mês'
  END;

  -- Serviços (extrair de observações se disponível)
  services_raw := NULL;
  IF NEW.observacoes IS NOT NULL AND NEW.observacoes ILIKE '%Serviços:%' THEN
    services_raw := NULLIF(btrim(split_part(NEW.observacoes, 'Serviços:', 2)), '');
    IF services_raw IS NOT NULL THEN
      services_raw := split_part(services_raw, E'|', 1);
      services_raw := split_part(services_raw, E'(', 1);
      services_raw := NULLIF(btrim(services_raw), '');
    END IF;
  END IF;

  IF services_raw IS NOT NULL THEN
    services_arr := regexp_split_to_array(services_raw, '\s*,\s*');
  ELSE
    services_arr := ARRAY[COALESCE(srv.nome, 'Serviço')];
  END IF;

  FOR s IN SELECT unnest(services_arr) LOOP
    IF s IS NULL OR btrim(s) = '' THEN CONTINUE; END IF;
    service_lines := service_lines || E'\n✂️ ' || btrim(s);
  END LOOP;

  -- Preço
  has_free_token := (NEW.observacoes ILIKE '%Corte Grátis%') OR (NEW.payment_method = 'resgate');
  has_credits_token := (NEW.observacoes ILIKE '%Créditos aplicados%');

  IF NEW.tipo_agendamento = 'plano' THEN 
    price_line := 'Plano';
  ELSIF has_free_token THEN
    IF COALESCE(NEW.preco, 0) <= 0 THEN
      price_line := 'Corte Grátis (Fidelidade)';
    ELSE
      price_line := 'Corte Grátis + R$ ' || to_char(NEW.preco, 'FM999999990.00');
    END IF;
  ELSIF has_credits_token THEN
    price_line := 'R$ ' || to_char(NEW.preco, 'FM999999990.00') || ' (Créditos aplicados)';
  ELSE 
    price_line := 'R$ ' || to_char(NEW.preco, 'FM999999990.00');
  END IF;

  com_barbeiro := CASE WHEN barb.apelido IS NOT NULL THEN ' com ' || barb.apelido ELSE '' END;

  -- Buscar template
  SELECT conteudo, ativo INTO template_conteudo, template_ativo
  FROM public.mensagem_templates
  WHERE slug = 'confirmacao_agendamento'
  LIMIT 1;

  IF template_conteudo IS NOT NULL AND COALESCE(template_ativo, true) = true THEN
    msg := template_conteudo;
    msg := replace(msg, '{nome}', first_name);
    msg := replace(msg, '{hora}', to_char(NEW.hora, 'HH24:MI'));
    msg := replace(msg, '{data}', date_pretty);
    msg := replace(msg, '{servico}', ltrim(service_lines, E'\n'));
    msg := replace(msg, '{barbeiro}', com_barbeiro);
    msg := replace(msg, '{preco}', price_line);
  ELSE
    msg := 'Olá ' || first_name || '! 🎉'
      || E'\n\nSeu agendamento foi confirmado!\n'
      || E'\n📅 ' || date_pretty
      || E'\n⏰ ' || to_char(NEW.hora, 'HH24:MI')
      || CASE WHEN barb.apelido IS NOT NULL THEN E'\n💈 ' || barb.apelido ELSE '' END
      || service_lines
      || E'\n💰 ' || price_line
      || E'\n\nAguardamos você! Qualquer dúvida, estamos à disposição.';
  END IF;

  -- Enviar usando o helper
  PERFORM public.send_agendamento_whatsapp_webhook(NEW.id, 'agendamento_confirmado', msg);

  RETURN NEW;
END;
$function$;

-- 3. New trigger function for Appointment Creation (pending confirmation)
CREATE OR REPLACE FUNCTION public.trg_notify_new_appointment_whatsapp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  barb record;
  cli record;
  srv record;
  msg text;
  already_sent boolean;
  date_pretty text;
  price_line text;
  service_lines text := '';
  services_raw text;
  services_arr text[];
  s text;
  first_name text;
  template_conteudo text;
  template_ativo boolean;
  com_barbeiro text;
  has_free_token boolean;
  has_credits_token boolean;
  v_dow int;
  v_day int;
  v_month int;
BEGIN
  -- Apenas no INSERT e se NÃO estiver confirmado ainda (se estiver confirmado, o outro trigger cuida)
  IF TG_OP <> 'INSERT' OR COALESCE(NEW.barbeiro_confirmou, false) = true THEN
    RETURN NEW;
  END IF;

  -- Evitar duplicidade
  SELECT EXISTS (
    SELECT 1 FROM public.agendamento_lembretes_log
    WHERE agendamento_id = NEW.id AND kind = 'novo_agendamento' AND channel = 'webhook'
  ) INTO already_sent;
  IF already_sent THEN RETURN NEW; END IF;

  -- Carregar dados
  SELECT apelido INTO barb FROM public.barbeiros WHERE id = NEW.barbeiro_id;
  SELECT nome, telefone INTO cli FROM public.profiles WHERE id = NEW.user_id;
  SELECT nome INTO srv FROM public.servicos WHERE id = NEW.servico_id;
  first_name := split_part(COALESCE(cli.nome, 'Cliente'), ' ', 1);

  -- Formatar data
  v_dow := EXTRACT(DOW FROM NEW.data)::int;
  v_day := EXTRACT(DAY FROM NEW.data)::int;
  v_month := EXTRACT(MONTH FROM NEW.data)::int;
  date_pretty := CASE v_dow
    WHEN 0 THEN 'domingo' WHEN 1 THEN 'segunda-feira' WHEN 2 THEN 'terça-feira'
    WHEN 3 THEN 'quarta-feira' WHEN 4 THEN 'quinta-feira'
    WHEN 5 THEN 'sexta-feira' WHEN 6 THEN 'sábado' ELSE 'dia'
  END || ', ' || lpad(v_day::text, 2, '0') || ' de ' || CASE v_month
    WHEN 1 THEN 'janeiro' WHEN 2 THEN 'fevereiro' WHEN 3 THEN 'março'
    WHEN 4 THEN 'abril' WHEN 5 THEN 'maio' WHEN 6 THEN 'junho'
    WHEN 7 THEN 'julho' WHEN 8 THEN 'agosto' WHEN 9 THEN 'setembro'
    WHEN 10 THEN 'outubro' WHEN 11 THEN 'novembro' WHEN 12 THEN 'dezembro' ELSE 'mês'
  END;

  -- Serviços
  services_raw := NULL;
  IF NEW.observacoes IS NOT NULL AND NEW.observacoes ILIKE '%Serviços:%' THEN
    services_raw := NULLIF(btrim(split_part(NEW.observacoes, 'Serviços:', 2)), '');
    IF services_raw IS NOT NULL THEN
      services_raw := split_part(services_raw, E'|', 1);
      services_raw := split_part(services_raw, E'(', 1);
      services_raw := NULLIF(btrim(services_raw), '');
    END IF;
  END IF;

  IF services_raw IS NOT NULL THEN
    services_arr := regexp_split_to_array(services_raw, '\s*,\s*');
  ELSE
    services_arr := ARRAY[COALESCE(srv.nome, 'Serviço')];
  END IF;

  FOR s IN SELECT unnest(services_arr) LOOP
    IF s IS NULL OR btrim(s) = '' THEN CONTINUE; END IF;
    service_lines := service_lines || E'\n✂️ ' || btrim(s);
  END LOOP;

  -- Preço
  has_free_token := (NEW.observacoes ILIKE '%Corte Grátis%') OR (NEW.payment_method = 'resgate');
  has_credits_token := (NEW.observacoes ILIKE '%Créditos aplicados%');

  IF NEW.tipo_agendamento = 'plano' THEN 
    price_line := 'Plano';
  ELSIF has_free_token THEN
    IF COALESCE(NEW.preco, 0) <= 0 THEN
      price_line := 'Corte Grátis (Fidelidade)';
    ELSE
      price_line := 'Corte Grátis + R$ ' || to_char(NEW.preco, 'FM999999990.00');
    END IF;
  ELSIF has_credits_token THEN
    price_line := 'R$ ' || to_char(NEW.preco, 'FM999999990.00') || ' (Créditos aplicados)';
  ELSE 
    price_line := 'R$ ' || to_char(NEW.preco, 'FM999999990.00');
  END IF;

  com_barbeiro := CASE WHEN barb.apelido IS NOT NULL THEN ' com ' || barb.apelido ELSE '' END;

  -- Buscar template (novo_agendamento)
  SELECT conteudo, ativo INTO template_conteudo, template_ativo
  FROM public.mensagem_templates
  WHERE slug = 'novo_agendamento'
  LIMIT 1;

  -- Mesmo que o template esteja desativado na tabela, se o usuário pediu varredura por completo, 
  -- vamos garantir que pelo menos uma mensagem básica seja enviada se não houver template.
  -- Mas respeitaremos o 'ativo' se for um desejo explícito de desativar.
  -- No entanto, aqui vamos forçar o envio da mensagem padrão se o template não existir.
  
  IF template_conteudo IS NOT NULL AND COALESCE(template_ativo, true) = true THEN
    msg := template_conteudo;
    msg := replace(msg, '{nome}', first_name);
    msg := replace(msg, '{hora}', to_char(NEW.hora, 'HH24:MI'));
    msg := replace(msg, '{data}', date_pretty);
    msg := replace(msg, '{servico}', ltrim(service_lines, E'\n'));
    msg := replace(msg, '{barbeiro}', com_barbeiro);
    msg := replace(msg, '{preco}', price_line);
  ELSE
    msg := '📋 *Novo agendamento!*'
      || E'\n\nOlá ' || first_name || E'!\n'
      || E'\n📅 ' || date_pretty
      || E'\n⏰ ' || to_char(NEW.hora, 'HH24:MI')
      || CASE WHEN barb.apelido IS NOT NULL THEN E'\n💈 ' || barb.apelido ELSE '' END
      || service_lines
      || E'\n💰 ' || price_line
      || E'\n\nAguarde a confirmação do barbeiro. 🔔';
  END IF;

  -- Enviar usando o helper
  PERFORM public.send_agendamento_whatsapp_webhook(NEW.id, 'novo_agendamento', msg);

  RETURN NEW;
END;
$function$;

-- 4. Create/Recreate triggers
DROP TRIGGER IF EXISTS trg_notify_new_appointment_whatsapp ON public.agendamentos;
CREATE TRIGGER trg_notify_new_appointment_whatsapp
AFTER INSERT ON public.agendamentos
FOR EACH ROW
EXECUTE FUNCTION public.trg_notify_new_appointment_whatsapp();

-- Cleanup any misnamed triggers from previous turn
DROP TRIGGER IF EXISTS trg_notify_agendamento_webhook ON public.agendamentos;
DROP FUNCTION IF EXISTS public.notify_agendamento_webhook();
