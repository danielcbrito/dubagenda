CREATE OR REPLACE FUNCTION public.trg_notify_new_appointment_whatsapp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_msg text;
  v_nome_cli text;
BEGIN
  BEGIN
    -- Se for INSERT, ainda não estiver confirmado e NÃO for um tipo silenciado
    -- Silenciamos 'assinatura_silenciosa', 'plano_registro_interno', 'plano' e 'encaixe_manual'
    -- para evitar mensagens indesejadas quando o barbeiro manipula assinaturas ou faz registros internos.
    IF TG_OP = 'INSERT' 
       AND COALESCE(NEW.barbeiro_confirmou, false) = false 
       AND COALESCE(NEW.tipo_agendamento, '') NOT IN ('assinatura_silenciosa', 'plano_registro_interno', 'plano', 'encaixe_manual') THEN
       
      SELECT split_part(COALESCE(nome, 'Cliente'), ' ', 1) INTO v_nome_cli FROM public.profiles WHERE id = NEW.user_id;
      
      -- Mensagem com quebra de linha simples para evitar múltiplas mensagens no WhatsApp
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
 SECURITY DEFINER
AS $function$
 DECLARE
   v_msg text;
   v_nome_cli text;
   v_barbeiro_nome text;
 BEGIN
   BEGIN
     -- Só envia se NÃO for registro interno de plano
     IF COALESCE(NEW.tipo_agendamento, '') NOT IN ('plano_registro_interno', 'plano', 'assinatura_silenciosa') AND (
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