-- Atualiza a função de notificação de novo agendamento para ser mais rigorosa com planos
CREATE OR REPLACE FUNCTION public.trg_notify_new_appointment_whatsapp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_msg text;
  v_nome_cli text;
  v_has_plan boolean;
BEGIN
  BEGIN
    -- Verifica se o usuário tem um plano ativo
    SELECT EXISTS (
      SELECT 1 FROM public.assinaturas 
      WHERE user_id = NEW.user_id 
        AND status = 'active'
    ) INTO v_has_plan;

    -- Se for INSERT, ainda não estiver confirmado e NÃO for um tipo silenciado E NÃO tiver plano
    IF TG_OP = 'INSERT' 
       AND COALESCE(NEW.barbeiro_confirmou, false) = false 
       AND NOT v_has_plan
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

-- Atualiza a função de confirmação para também verificar assinaturas ativas
CREATE OR REPLACE FUNCTION public.trg_send_confirm_message_on_barber_confirm()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
 DECLARE
   v_msg text;
   v_nome_cli text;
   v_barbeiro_nome text;
   v_has_plan boolean;
 BEGIN
   BEGIN
     -- Verifica se o usuário tem um plano ativo
     SELECT EXISTS (
       SELECT 1 FROM public.assinaturas 
       WHERE user_id = NEW.user_id 
         AND status = 'active'
     ) INTO v_has_plan;

     -- Só envia se NÃO for registro interno de plano E NÃO tiver plano ativo (silencioso por padrão para assinantes)
     IF NOT v_has_plan 
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
