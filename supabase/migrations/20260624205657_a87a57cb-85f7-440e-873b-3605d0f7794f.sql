
CREATE OR REPLACE FUNCTION public.refund_wallet_on_barber_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_method TEXT;
  v_amount NUMERIC;
  v_already_refunded BOOLEAN;
  v_current_balance NUMERIC;
  v_woovi RECORD;
  v_meta JSONB;
  v_desc_suffix TEXT := '';
BEGIN
  IF NEW.status::text <> 'cancelled_by_admin' THEN RETURN NEW; END IF;
  IF OLD.status::text NOT IN ('pending','confirmed') THEN RETURN NEW; END IF;

  v_method := COALESCE(NEW.payment_method, '');
  v_amount := COALESCE(NEW.preco, 0);

  IF COALESCE(NEW.is_free, false) OR v_amount <= 0 THEN RETURN NEW; END IF;
  IF v_method NOT IN ('pix','card','credit_card','credit','wallet') THEN RETURN NEW; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.wallet_transactions
    WHERE user_id = NEW.user_id AND type = 'refund'
      AND (metadata->>'agendamento_id') = NEW.id::text
  ) INTO v_already_refunded;
  IF v_already_refunded THEN RETURN NEW; END IF;

  v_meta := jsonb_build_object('source','barber_cancellation','agendamento_id', NEW.id::text);

  IF v_method = 'pix' THEN
    SELECT correlation_id, raw_response, value_centavos INTO v_woovi
      FROM public.woovi_charges
     WHERE agendamento_id = NEW.id AND status='PAID' LIMIT 1;
    IF FOUND THEN
      v_meta := v_meta || jsonb_build_object(
        'woovi_correlation_id', v_woovi.correlation_id,
        'woovi_endToEndId', COALESCE(
          v_woovi.raw_response->'pix'->>'endToEndId',
          v_woovi.raw_response->>'endToEndId',
          v_woovi.raw_response->'charge'->>'endToEndId'
        ),
        'woovi_value_centavos', COALESCE(v_woovi.value_centavos, ROUND(v_amount * 100))
      );
    END IF;
    v_desc_suffix := ' (PIX)';
    BEGIN
      UPDATE public.pagamentos SET status='refunded' WHERE agendamento_id = NEW.id;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  ELSIF v_method IN ('card','credit_card') THEN
    v_desc_suffix := ' (Cartão)';
  END IF;

  v_current_balance := public.get_or_create_wallet_balance(NEW.user_id);
  UPDATE public.wallet_balances SET balance = COALESCE(balance,0) + v_amount WHERE user_id = NEW.user_id;

  INSERT INTO public.wallet_transactions (user_id, type, amount, status, description, metadata)
  VALUES (NEW.user_id, 'refund', v_amount, 'completed',
    'Estorno por cancelamento do barbeiro' || v_desc_suffix || ' - R$ ' || to_char(v_amount, 'FM999990.00'),
    v_meta);

  INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, agendamento_id)
  VALUES (NEW.user_id, 'cancelamento', 'Agendamento cancelado pelo barbeiro',
    'Seu agendamento foi cancelado. R$ ' || to_char(v_amount, 'FM999990.00') || ' foi creditado na sua carteira.',
    NEW.id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refund_wallet_on_barber_cancel ON public.agendamentos;
CREATE TRIGGER trg_refund_wallet_on_barber_cancel
AFTER UPDATE OF status ON public.agendamentos
FOR EACH ROW EXECUTE FUNCTION public.refund_wallet_on_barber_cancel();

-- Backfill Daniel Brito's cancelled appointment
DO $$
DECLARE
  v_ag RECORD; v_already BOOLEAN; v_bal NUMERIC; v_meta JSONB; v_woovi RECORD;
BEGIN
  SELECT id, user_id, preco, payment_method, is_free INTO v_ag
    FROM public.agendamentos WHERE id='35bae0d7-10da-416f-9811-c11f145d2303';
  IF NOT FOUND THEN RETURN; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.wallet_transactions
    WHERE user_id=v_ag.user_id AND type='refund'
      AND (metadata->>'agendamento_id')=v_ag.id::text
  ) INTO v_already;
  IF v_already THEN RETURN; END IF;

  v_meta := jsonb_build_object('source','barber_cancellation_backfill','agendamento_id', v_ag.id::text);
  SELECT correlation_id, raw_response, value_centavos INTO v_woovi
    FROM public.woovi_charges WHERE agendamento_id=v_ag.id AND status='PAID' LIMIT 1;
  IF FOUND THEN
    v_meta := v_meta || jsonb_build_object(
      'woovi_correlation_id', v_woovi.correlation_id,
      'woovi_endToEndId', COALESCE(
        v_woovi.raw_response->'pix'->>'endToEndId',
        v_woovi.raw_response->>'endToEndId',
        v_woovi.raw_response->'charge'->>'endToEndId'
      ),
      'woovi_value_centavos', COALESCE(v_woovi.value_centavos, ROUND(v_ag.preco * 100))
    );
  END IF;

  v_bal := public.get_or_create_wallet_balance(v_ag.user_id);
  UPDATE public.wallet_balances SET balance = COALESCE(balance,0) + v_ag.preco WHERE user_id=v_ag.user_id;

  INSERT INTO public.wallet_transactions (user_id,type,amount,status,description,metadata)
  VALUES (v_ag.user_id,'refund',v_ag.preco,'completed',
    'Estorno por cancelamento do barbeiro (PIX) - R$ ' || to_char(v_ag.preco,'FM999990.00'), v_meta);

  BEGIN
    UPDATE public.pagamentos SET status='refunded' WHERE agendamento_id=v_ag.id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  INSERT INTO public.notificacoes (user_id,tipo,titulo,mensagem,agendamento_id)
  VALUES (v_ag.user_id,'cancelamento','Reembolso processado',
    'O cancelamento feito pelo barbeiro foi reembolsado. R$ ' || to_char(v_ag.preco,'FM999990.00') || ' creditado na sua carteira.',
    v_ag.id);
END $$;
