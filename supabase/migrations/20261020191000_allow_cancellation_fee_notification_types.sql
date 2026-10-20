-- Migration: Permitir tipos de notificação de taxa de cancelamento e pendência
-- Evita erro 23514 (notificacoes_tipo_check) ao cancelar agendamento com taxa aplicada

ALTER TABLE public.notificacoes DROP CONSTRAINT IF EXISTS notificacoes_tipo_check;

ALTER TABLE public.notificacoes ADD CONSTRAINT notificacoes_tipo_check CHECK (
  tipo = ANY (ARRAY[
    'cancelamento'::text,
    'taxa_cancelamento'::text,
    'taxa_pendente'::text,
    'remarcacao'::text,
    'cancelamento_massa'::text,
    'geral'::text,
    'plano_pendente'::text,
    'agendamento_confirmado'::text,
    'atendimento_concluido'::text,
    'lembrete'::text,
    'whatsapp_desconectado'::text
  ])
);

-- Garantir tratamento de exceção seguro no trigger de débito para que falha de notificação nunca aborte cancelamentos
CREATE OR REPLACE FUNCTION public.record_client_cancellation_debt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  q jsonb;
  fee numeric;
  existing public.informacoes_empresa%ROWTYPE;
  existing_val jsonb;
  existing_itens jsonb;
  new_item jsonb;
  total_pendente numeric;
  t uuid;
  client_name text;
  client_phone text;
  barber_name text;
  orig_price numeric;
  is_no_show boolean := false;
  motivo text;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'cancelled_by_user' AND OLD.status IN ('pending', 'confirmed') THEN
    motivo := 'cancelamento_tardio';
    is_no_show := false;
  ELSIF NEW.status = 'no_show' AND OLD.status IN ('pending', 'confirmed') THEN
    motivo := 'falta';
    is_no_show := true;
  ELSE
    RETURN NEW;
  END IF;

  IF NEW.status = 'cancelled_by_user' AND NEW.payment_method IN ('pix', 'card', 'credit_card', 'credit', 'wallet') AND COALESCE(NEW.preco, 0) > 0 THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('cancel-debt:' || NEW.user_id::text, 0));

  q := public.quote_client_cancellation(NEW.id, NEW.user_id);
  fee := (q->>'valor_taxa')::numeric;
  t := (q->>'tenant_id')::uuid;

  IF is_no_show THEN
    fee := public.cancellation_fee_amount(
      COALESCE(q->'config', '{}'::jsonb),
      (q->>'valor_servico_original')::numeric,
      now(),
      now(),
      true
    );
  END IF;

  IF fee <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT * INTO existing FROM public.informacoes_empresa
  WHERE tenant_id = t AND categoria = 'debitos_cliente' AND chave = 'debito_cancelamento_' || NEW.user_id
  FOR UPDATE;

  SELECT nome, telefone INTO client_name, client_phone FROM public.profiles WHERE id = NEW.user_id;
  SELECT apelido INTO barber_name FROM public.barbeiros WHERE id = NEW.barbeiro_id;

  orig_price := COALESCE(NULLIF((q->>'valor_servico_original')::numeric, 0), NEW.preco, 0);

  new_item := jsonb_build_object(
    'id', gen_random_uuid(),
    'agendamento_id', NEW.id,
    'barbeiro_id', NEW.barbeiro_id,
    'barbeiro_nome', COALESCE(barber_name, 'Barbeiro'),
    'motivo', motivo,
    'valor_taxa', fee,
    'tipo_taxa', COALESCE(q->'config'->>'tipo', 'porcentagem'),
    'porcentagem_aplicada', CASE WHEN COALESCE(q->'config'->>'tipo', 'porcentagem') = 'porcentagem' THEN COALESCE((q->'config'->>'valor')::numeric, 20) ELSE NULL END,
    'valor_servico_original', orig_price,
    'status', 'pendente',
    'created_at', now(),
    'tenant_id', t
  );

  IF existing.id IS NOT NULL AND existing.valor IS NOT NULL THEN
    existing_val := existing.valor::jsonb;
    
    IF existing_val ? 'itens' AND jsonb_typeof(existing_val->'itens') = 'array' THEN
      existing_itens := existing_val->'itens';
    ELSE
      existing_itens := jsonb_build_array(existing_val);
    END IF;

    existing_itens := existing_itens || jsonb_build_array(new_item);

    SELECT COALESCE(SUM((item->>'valor_taxa')::numeric), 0)
    INTO total_pendente
    FROM jsonb_array_elements(existing_itens) AS item
    WHERE item->>'status' = 'pendente';

    existing_val := jsonb_build_object(
      'id', COALESCE(existing_val->>'id', gen_random_uuid()::text),
      'cliente_id', NEW.user_id,
      'cliente_nome', COALESCE(client_name, existing_val->>'cliente_nome', ''),
      'cliente_telefone', COALESCE(client_phone, existing_val->>'cliente_telefone', ''),
      'total_pendente', total_pendente,
      'valor_taxa', total_pendente,
      'status', CASE WHEN total_pendente > 0 THEN 'pendente' ELSE 'pago' END,
      'itens', existing_itens,
      'tenant_id', t,
      'updated_at', now()
    );

    UPDATE public.informacoes_empresa
    SET valor = existing_val::text, ativo = true, atualizado_em = now()
    WHERE id = existing.id;
  ELSE
    existing_val := jsonb_build_object(
      'id', gen_random_uuid(),
      'cliente_id', NEW.user_id,
      'cliente_nome', COALESCE(client_name, ''),
      'cliente_telefone', COALESCE(client_phone, ''),
      'total_pendente', fee,
      'valor_taxa', fee,
      'status', 'pendente',
      'itens', jsonb_build_array(new_item),
      'tenant_id', t,
      'created_at', now()
    );

    INSERT INTO public.informacoes_empresa(tenant_id, chave, categoria, valor, ativo)
    VALUES(t, 'debito_cancelamento_' || NEW.user_id, 'debitos_cliente', existing_val::text, true);
  END IF;

  BEGIN
    INSERT INTO public.notificacoes(user_id, tipo, titulo, mensagem, agendamento_id, created_at)
    VALUES (
      NEW.user_id,
      'taxa_pendente',
      CASE WHEN is_no_show THEN 'Taxa por não comparecimento' ELSE 'Taxa de cancelamento registrada' END,
      CASE 
        WHEN is_no_show THEN 'Você não compareceu ao atendimento. Uma taxa de R$ ' || to_char(fee, 'FM999G990D00') || ' foi registrada e será somada no seu próximo agendamento.'
        ELSE 'Cancelamento com menos de 2h de antecedência. Taxa de R$ ' || to_char(fee, 'FM999G990D00') || ' registrada para seu próximo agendamento.'
      END,
      NEW.id,
      now()
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END $function$;
