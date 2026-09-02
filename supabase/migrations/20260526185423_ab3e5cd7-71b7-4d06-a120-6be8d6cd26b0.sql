-- 1. Corrigir o gatilho que forçava preço zero em qualquer resgate (destruindo o valor de combos)
CREATE OR REPLACE FUNCTION public.enforce_resgate_flags()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Se o método é resgate, marcamos como is_free
  IF COALESCE(NEW.payment_method, '') = 'resgate' THEN
    NEW.is_free := true;
    -- APENAS zeramos o preço se ele ainda não foi calculado/definido (ou se for <= 0)
    -- Isso permite que combos (Corte + Barba) mantenham o valor residual da Barba
    IF NEW.preco IS NULL OR NEW.preco <= 0 THEN
      NEW.preco := 0;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Corrigir o gatilho de consumo de resgate no INSERT
CREATE OR REPLACE FUNCTION public.consume_redemption_on_appointment_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_redemption_id uuid;
  v_service_name text;
  v_points integer;
BEGIN
  -- Só aplica para cortes grátis via resgate
  IF COALESCE(NEW.payment_method, '') <> 'resgate' THEN
    RETURN NEW;
  END IF;

  -- 1. Validar se o serviço é "Corte" ou contém corte
  SELECT nome INTO v_service_name FROM public.servicos WHERE id = NEW.servico_id;
  IF lower(v_service_name) NOT LIKE '%corte%' THEN
    INSERT INTO public.loyalty_audit_logs (user_id, action, reason, metadata)
    VALUES (NEW.user_id, 'redemption_blocked', 'Tentativa de usar corte grátis em serviço inválido: ' || v_service_name, jsonb_build_object('service_id', NEW.servico_id));
    RAISE EXCEPTION 'O benefício de corte grátis só pode ser aplicado a serviços de Corte.';
  END IF;

  -- 2. Validar pontos (mantemos a regra de negócio)
  SELECT pontos INTO v_points FROM public.pontos WHERE user_id = NEW.user_id;
  IF v_points < 8 THEN
    INSERT INTO public.loyalty_audit_logs (user_id, action, reason, points_before)
    VALUES (NEW.user_id, 'redemption_blocked', 'Tentativa de resgate com pontos insuficientes: ' || v_points, v_points);
    RAISE EXCEPTION 'Você precisa de exatamente 8 pontos para resgatar o corte grátis.';
  END IF;

  -- Seleciona 1 resgate disponível
  SELECT r.id
  INTO v_redemption_id
  FROM public.resgates r
  WHERE r.user_id = NEW.user_id
    AND r.status = 'available'
    AND r.used_at IS NULL
    AND (r.expired_at IS NULL OR r.expired_at > now())
  ORDER BY r.created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_redemption_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum resgate disponível encontrado.';
  END IF;

  -- Marca resgate como usado
  UPDATE public.resgates
  SET status = 'used',
      used_at = now(),
      appointment_id = NEW.id
  WHERE id = v_redemption_id;

  -- RESETAR PONTOS PARA 0 após a utilização
  UPDATE public.pontos
  SET pontos = 0,
      updated_at = now()
  WHERE user_id = NEW.user_id;

  INSERT INTO public.loyalty_audit_logs (user_id, action, reason, points_before, points_after, appointment_id)
  VALUES (NEW.user_id, 'redemption_success', 'Corte grátis utilizado com sucesso', v_points, 0, NEW.id);

  -- Garante consistência no agendamento
  NEW.usado_redemption_id := v_redemption_id;
  NEW.is_free := true;
  -- NÃO sobrescrevemos NEW.preco aqui se ele já vier do app (para suportar combos)
  IF NEW.preco IS NULL THEN
    NEW.preco := 0;
  END IF;

  RETURN NEW;
END;
$function$;

-- 3. Melhorar a mensagem de confirmação para ser mais clara sobre descontos
CREATE OR REPLACE FUNCTION public.trg_send_confirm_message_on_barber_confirm()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  cfg record;
  cli record;
  srv record;
  barb record;
  whatsapp_inst record;
  services_raw text;
  services_arr text[];
  s text;
  service_lines text := '';
  first_name text;
  msg text;
  request_id bigint;
  already_sent boolean;
  date_pretty text;
  price_line text;
  has_free_token boolean := false;
  has_credits_token boolean := false;
  v_dow int;
  v_day int;
  v_month int;
  template_conteudo text;
  template_ativo boolean;
  com_barbeiro text;
  v_tenant_id uuid;
BEGIN
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

  SELECT EXISTS (
    SELECT 1 FROM public.agendamento_lembretes_log
    WHERE agendamento_id = NEW.id AND kind = 'agendamento_confirmado' AND channel = 'webhook'
  ) INTO already_sent;
  IF already_sent THEN RETURN NEW; END IF;

  SELECT id, apelido, tenant_id INTO barb FROM public.barbeiros WHERE id = NEW.barbeiro_id;
  v_tenant_id := barb.tenant_id;

  SELECT wi.instance_name, wi.api_key, wi.status
  INTO whatsapp_inst
  FROM public.whatsapp_instances wi
  WHERE (wi.barbeiro_id = NEW.barbeiro_id OR wi.barbeiro_id IN (SELECT id FROM public.barbeiros WHERE tenant_id = v_tenant_id))
    AND wi.status = 'connected'
  ORDER BY (wi.barbeiro_id = NEW.barbeiro_id) DESC, wi.updated_at DESC
  LIMIT 1;

  IF whatsapp_inst IS NULL OR whatsapp_inst.instance_name IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT webhook_url, ativo INTO cfg FROM public.webhook_config LIMIT 1;
  IF cfg.webhook_url IS NULL OR cfg.ativo <> true THEN RETURN NEW; END IF;

  SELECT conteudo, ativo INTO template_conteudo, template_ativo
  FROM public.mensagem_templates
  WHERE slug = 'confirmacao_agendamento'
  LIMIT 1;

  SELECT id, nome, telefone INTO cli FROM public.profiles WHERE id = NEW.user_id;
  SELECT id, nome INTO srv FROM public.servicos WHERE id = NEW.servico_id;
  first_name := split_part(COALESCE(cli.nome, 'Cliente'), ' ', 1);

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

  services_raw := NULL;
  IF NEW.observacoes IS NOT NULL AND NEW.observacoes ILIKE '%Serviços:%' THEN
    services_raw := NULLIF(btrim(split_part(NEW.observacoes, 'Serviços:', 2)), '');
    IF services_raw IS NOT NULL THEN
      services_raw := split_part(services_raw, E'|', 1); -- Separar se houver outros tokens como créditos
      services_raw := split_part(services_raw, E'(', 1); -- Separar se houver (Inclui Corte Grátis)
      services_raw := NULLIF(btrim(services_raw), '');
    END IF;
  END IF;

  IF services_raw IS NOT NULL THEN
    services_arr := regexp_split_to_array(services_raw, '\s*,\s*');
  ELSE
    services_arr := ARRAY[COALESCE(srv.nome, 'Serviço')];
  END IF;

  service_lines := '';
  FOR s IN SELECT unnest(services_arr) LOOP
    IF s IS NULL OR btrim(s) = '' THEN CONTINUE; END IF;
    service_lines := service_lines || E'\n✂️ ' || btrim(s);
  END LOOP;

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

  SELECT net.http_post(
    url := cfg.webhook_url,
    body := jsonb_build_object(
      'evento', 'agendamento_confirmado',
      'agendamento_id', NEW.id,
      'timestamp', now(),
      'contatos', jsonb_build_array(
        jsonb_build_object(
          'cliente_nome', cli.nome,
          'cliente_telefone_whatsapp', public.format_phone_for_whatsapp(cli.telefone),
          'mensagem', msg
        )
      )
    ),
    headers := '{"Content-Type":"application/json"}'::jsonb
  ) INTO request_id;

  INSERT INTO public.agendamento_lembretes_log (agendamento_id, user_id, kind, channel, scheduled_for, status, details)
  VALUES (NEW.id, NEW.user_id, 'agendamento_confirmado', 'webhook', now(), 'sent', jsonb_build_object('net_request_id', request_id));

  RETURN NEW;
END;
$function$;