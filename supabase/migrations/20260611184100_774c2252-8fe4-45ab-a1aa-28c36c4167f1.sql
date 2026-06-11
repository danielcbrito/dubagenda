-- 1. Identificar as duplicatas (IDs que serão removidos)
CREATE TEMP TABLE to_delete AS
WITH duplicates AS (
    SELECT id, ROW_NUMBER() OVER (
        PARTITION BY user_id, barbeiro_id, data, hora, servico_id 
        ORDER BY created_at ASC, id ASC
    ) as row_num
    FROM public.agendamentos
)
SELECT id FROM duplicates WHERE row_num > 1;

-- 2. Remover referências em tabelas filhas antes de deletar os agendamentos
DELETE FROM public.plano_agendamentos_usos WHERE agendamento_id IN (SELECT id FROM to_delete);
DELETE FROM public.resgates WHERE appointment_id IN (SELECT id FROM to_delete);
DELETE FROM public.comissoes WHERE appointment_id IN (SELECT id FROM to_delete);
DELETE FROM public.pagamentos WHERE agendamento_id IN (SELECT id FROM to_delete);
DELETE FROM public.payments WHERE agendamento_id IN (SELECT id FROM to_delete);
DELETE FROM public.pix_charges WHERE agendamento_id IN (SELECT id FROM to_delete);
DELETE FROM public.financial_entries WHERE related_appointment_id IN (SELECT id FROM to_delete);
DELETE FROM public.logs_agendamentos WHERE agendamento_id IN (SELECT id FROM to_delete);
DELETE FROM public.notificacoes WHERE agendamento_id IN (SELECT id FROM to_delete);

-- 3. Finalmente deletar os agendamentos duplicados
DELETE FROM public.agendamentos WHERE id IN (SELECT id FROM to_delete);

-- 4. Adicionar índices únicos parciais para evitar duplicatas futuras
-- Evita que um barbeiro tenha dois agendamentos ativos no mesmo horário
CREATE UNIQUE INDEX IF NOT EXISTS idx_agendamentos_barber_time_unique 
ON public.agendamentos (barbeiro_id, data, hora) 
WHERE (status NOT IN ('cancelled_by_admin', 'cancelled_by_user', 'no_show', 'excluido'));

-- Evita que um usuário tenha dois agendamentos ativos no mesmo horário
CREATE UNIQUE INDEX IF NOT EXISTS idx_agendamentos_user_time_unique 
ON public.agendamentos (user_id, data, hora) 
WHERE (status NOT IN ('cancelled_by_admin', 'cancelled_by_user', 'no_show', 'excluido'));

-- 5. Atualizar gatilhos para bloqueio de WhatsApp
CREATE OR REPLACE FUNCTION public.trg_notify_new_appointment_whatsapp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_msg text;
  v_nome_cli text;
  v_has_any_subscription boolean;
BEGIN
  BEGIN
    -- Verifica assinaturas
    SELECT EXISTS (
      SELECT 1 FROM public.assinaturas 
      WHERE user_id = NEW.user_id 
        AND status IN ('active', 'pending_cash', 'pending_renewal', 'suspended')
    ) INTO v_has_any_subscription;

    -- Bloqueio agressivo
    IF TG_OP = 'INSERT' 
       AND COALESCE(NEW.barbeiro_confirmou, false) = false 
       AND NOT v_has_any_subscription
       AND COALESCE(NEW.criado_por, 'cliente') NOT IN ('barbeiro', 'admin')
       AND COALESCE(NEW.tipo_agendamento, '') NOT IN ('assinatura_silenciosa', 'plano_registro_interno', 'plano', 'encaixe_manual') THEN
       
      SELECT split_part(COALESCE(nome, 'Cliente'), ' ', 1) INTO v_nome_cli FROM public.profiles WHERE id = NEW.user_id;
      
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

CREATE OR REPLACE FUNCTION public.trg_send_confirm_message_on_barber_confirm()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
 DECLARE
   v_msg text;
   v_nome_cli text;
   v_barbeiro_nome text;
   v_has_any_subscription boolean;
 BEGIN
   BEGIN
     -- Verifica assinaturas
     SELECT EXISTS (
       SELECT 1 FROM public.assinaturas 
       WHERE user_id = NEW.user_id 
         AND status IN ('active', 'pending_cash', 'pending_renewal', 'suspended')
     ) INTO v_has_any_subscription;

     -- Silêncio absoluto para assinantes
     IF NOT v_has_any_subscription 
        AND COALESCE(NEW.tipo_agendamento, '') NOT IN ('plano_registro_interno', 'plano', 'assinatura_silenciosa') AND (
        (TG_OP = 'UPDATE' AND NEW.status = 'confirmed' AND OLD.status <> 'confirmed') OR
        (TG_OP = 'INSERT' AND NEW.status = 'confirmed')
     ) THEN
        
       SELECT split_part(COALESCE(nome, 'Cliente'), ' ', 1) INTO v_nome_cli FROM public.profiles WHERE id = NEW.user_id;
       SELECT apelido INTO v_barbeiro_nome FROM public.barbeiros WHERE id = NEW.barbeiro_id;

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
