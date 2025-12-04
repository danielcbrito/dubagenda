import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaas-access-token',
};

interface AsaasWebhookEvent {
  event: string;
  payment?: {
    id: string;
    customer: string;
    value: number;
    netValue?: number;
    status: string;
    dueDate?: string;
    paymentDate?: string;
    billingType?: string;
    description?: string;
    externalReference?: string;
    subscription?: string; // Subscription ID if payment is related to a subscription
  };
  subscription?: {
    id: string;
    customer: string;
    value: number;
    status: string;
    nextDueDate?: string;
    externalReference?: string;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate webhook secret
    const webhookSecret = Deno.env.get('ASAAS_WEBHOOK_SECRET');
    const asaasToken = req.headers.get('asaas-access-token');
    
    if (!webhookSecret) {
      console.error('ASAAS_WEBHOOK_SECRET not configured');
      return new Response(
        JSON.stringify({ error: 'Webhook secret not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (asaasToken !== webhookSecret) {
      console.error('Invalid webhook token received');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse webhook payload
    const payload: AsaasWebhookEvent = await req.json();
    console.log('Webhook received:', JSON.stringify(payload, null, 2));

    // Log webhook event for audit
    const { error: logError } = await supabase
      .from('webhook_logs')
      .insert({
        provider: 'asaas',
        event_type: payload.event,
        payload: payload,
        processed_at: new Date().toISOString(),
      });

    if (logError) {
      console.error('Error logging webhook:', logError);
      // Continue processing even if log fails
    }

    // Process webhook events
    switch (payload.event) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED':
        await handlePaymentConfirmed(supabase, payload);
        break;

      case 'PAYMENT_OVERDUE':
        await handlePaymentOverdue(supabase, payload);
        break;

      case 'PAYMENT_DELETED':
      case 'PAYMENT_REFUNDED':
        await handlePaymentCancelled(supabase, payload);
        break;

      case 'PAYMENT_CREATED':
        await handlePaymentCreated(supabase, payload);
        break;

      case 'PAYMENT_AWAITING_RISK_ANALYSIS':
      case 'PAYMENT_APPROVED_BY_RISK_ANALYSIS':
        await handlePaymentPending(supabase, payload);
        break;

      case 'PAYMENT_REPROVED_BY_RISK_ANALYSIS':
        await handlePaymentFailed(supabase, payload);
        break;

      // Subscription events
      case 'PAYMENT_SUBSCRIPTION_CREATED':
        await handleSubscriptionCreated(supabase, payload);
        break;

      case 'PAYMENT_SUBSCRIPTION_UPDATED':
        await handleSubscriptionUpdated(supabase, payload);
        break;

      default:
        console.log(`Unhandled event type: ${payload.event}`);
    }

    // Always return 200 OK to ASAAS
    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook processing error:', error);
    
    // Return 200 to prevent ASAAS retries on processing errors
    return new Response(
      JSON.stringify({ received: true, error: 'Internal processing error' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handlePaymentConfirmed(supabase: any, payload: AsaasWebhookEvent) {
  if (!payload.payment) return;

  console.log(`Processing payment confirmation: ${payload.payment.id}`);

  // First, check if this is a pending booking (PIX payment for reservation)
  // CORRIGIDO: Buscar por externalReference (ID do pending_booking) OU payment_intent_id
  if (payload.payment.externalReference) {
    const { data: pendingBooking } = await supabase
      .from('pending_bookings')
      .select('*')
      .or(`id.eq.${payload.payment.externalReference},payment_intent_id.eq.${payload.payment.id}`)
      .maybeSingle();

    if (pendingBooking) {
      console.log('Found pending booking, converting to appointment:', pendingBooking.id);

      // ============================================
      // VERIFICAÇÃO CRÍTICA: Verificar se horário ainda está disponível
      // CORRIGIDO: Sem buffer adicional para consistência com frontend
      // ============================================
      const [startHour, startMinute] = pendingBooking.hora.split(':').map(Number);
      const startTimeInMinutes = startHour * 60 + startMinute;
      const endTimeInMinutes = startTimeInMinutes + pendingBooking.duracao;
      // REMOVIDO buffer de 10 minutos para consistência

      const { data: existingAppointments } = await supabase
        .from('agendamentos')
        .select('id, hora, duracao')
        .eq('data', pendingBooking.data)
        .in('status', ['pending', 'confirmed', 'completed']); // INCLUIR completed

      let hasConflict = false;
      for (const apt of existingAppointments || []) {
        const [aptHour, aptMinute] = apt.hora.split(':').map(Number);
        const aptStart = aptHour * 60 + aptMinute;
        const aptEnd = aptStart + apt.duracao; // SEM buffer para consistência

        // Overlap correto: início1 < fim2 E fim1 > início2
        if (startTimeInMinutes < aptEnd && endTimeInMinutes > aptStart) {
          hasConflict = true;
          console.error('CONFLITO DETECTADO! Horário já ocupado:', { pendingBooking: pendingBooking.id, conflictApt: apt.id });
          break;
        }
      }

      if (hasConflict) {
        // Horário foi ocupado - precisamos notificar o cliente e reembolsar
        console.error('Pagamento confirmado mas horário já ocupado. Cliente precisa reagendar.');
        // Mantém o pending_booking para análise e não cria o agendamento
        // TODO: Implementar notificação ao cliente e processo de reembolso
        return;
      }

      // Create the appointment
      const { data: appointment, error: aptError } = await supabase
        .from('agendamentos')
        .insert({
          user_id: pendingBooking.user_id,
          servico_id: pendingBooking.servico_id,
          barbeiro_id: pendingBooking.barbeiro_id,
          data: pendingBooking.data,
          hora: pendingBooking.hora,
          duracao: pendingBooking.duracao,
          preco: pendingBooking.preco,
          observacoes: pendingBooking.observacoes,
          status: 'pending', // PENDING até barbeiro confirmar
          barbeiro_confirmou: false, // AGUARDANDO APROVAÇÃO DO BARBEIRO
          cliente_confirmou: true, // Cliente pagou via PIX
          payment_method: pendingBooking.payment_method, // Store payment method
        })
        .select()
        .single();

      if (aptError) {
        console.error('Failed to create appointment from pending booking:', aptError);
        return;
      }

      console.log('Appointment created:', appointment.id);

      // ============================================
      // INTEGRAÇÃO GOOGLE CALENDAR - Criar evento
      // ============================================
      try {
        const { data: servico } = await supabase
          .from('servicos')
          .select('nome')
          .eq('id', pendingBooking.servico_id)
          .single();

        const startDateTime = `${pendingBooking.data}T${pendingBooking.hora}:00`;
        const endDate = new Date(`${pendingBooking.data}T${pendingBooking.hora}`);
        endDate.setMinutes(endDate.getMinutes() + pendingBooking.duracao);
        const endDateTime = endDate.toISOString().slice(0, 19);

        console.log('Creating Google Calendar event for appointment:', appointment.id);
        
        // Chamar edge function de sync com Google Calendar
        const googleCalendarResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-calendar-sync`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              action: 'create',
              appointmentId: appointment.id,
              summary: `Agendamento: ${servico?.nome || 'Serviço'}`,
              description: `Cliente agendou ${servico?.nome || 'serviço'} - Pagamento via ${pendingBooking.payment_method?.toUpperCase() || 'PIX'}`,
              startDateTime,
              endDateTime,
            }),
          }
        );

        if (googleCalendarResponse.ok) {
          console.log('Google Calendar event created successfully');
        } else {
          console.error('Failed to create Google Calendar event:', await googleCalendarResponse.text());
        }
      } catch (gcError) {
        console.error('Error creating Google Calendar event:', gcError);
        // Não bloqueia o fluxo se Google Calendar falhar
      }

      // Save payment record
      const { error: paymentError } = await supabase
        .from('pagamentos')
        .insert({
          user_id: pendingBooking.user_id,
          agendamento_id: appointment.id,
          metodo: pendingBooking.payment_method,
          valor: pendingBooking.preco,
          gateway_payment_id: payload.payment.id,
          status: 'paid',
          data_pagamento: new Date().toISOString(),
        });

      if (paymentError) {
        console.error('Failed to save payment record:', paymentError);
        return;
      }

      // Delete pending booking
      await supabase.from('pending_bookings').delete().eq('id', pendingBooking.id);

      // ============================================
      // WEBHOOK INTEGRATION - Enviar eventos
      // ============================================
      try {
        // Buscar dados do perfil do cliente
        const { data: profile } = await supabase
          .from('profiles')
          .select('nome, telefone')
          .eq('id', pendingBooking.user_id)
          .single();

        // Buscar nome do serviço
        const { data: servico } = await supabase
          .from('servicos')
          .select('nome')
          .eq('id', pendingBooking.servico_id)
          .single();

        // Enviar evento de pagamento realizado
        await sendWebhookEvent(supabase, {
          evento: 'pagamento_realizado',
          agendamento_id: appointment.id,
          cliente_id: pendingBooking.user_id,
          cliente_nome: profile?.nome || 'Cliente',
          cliente_telefone: profile?.telefone,
          servico: servico?.nome || 'Serviço',
          data: pendingBooking.data,
          hora: pendingBooking.hora,
          preco: pendingBooking.preco,
          status: 'pago'
        });

        // Enviar evento de novo agendamento
        await sendWebhookEvent(supabase, {
          evento: 'novo_agendamento',
          agendamento_id: appointment.id,
          cliente_id: pendingBooking.user_id,
          cliente_nome: profile?.nome || 'Cliente',
          cliente_telefone: profile?.telefone,
          servico: servico?.nome || 'Serviço',
          data: pendingBooking.data,
          hora: pendingBooking.hora,
          preco: pendingBooking.preco,
          status: 'pendente'
        });
      } catch (webhookError) {
        console.error('Error sending webhook events:', webhookError);
        // Não bloqueia o fluxo se webhook falhar
      }

      console.log('Pending booking converted to appointment successfully');
      return;
    }
  }

  // Legacy flow: Update payment status in database (for old appointments)
  const { error: updateError } = await supabase
    .from('pagamentos')
    .update({
      status: 'paid',
      data_pagamento: new Date().toISOString(),
      gateway_payment_id: payload.payment.id,
    })
    .eq('gateway_payment_id', payload.payment.id);

  if (updateError) {
    console.error('Error updating payment:', updateError);
    return;
  }

  // Check if payment is for appointment or subscription
  const { data: payment } = await supabase
    .from('pagamentos')
    .select('agendamento_id, assinatura_id, user_id')
    .eq('gateway_payment_id', payload.payment.id)
    .maybeSingle();

  if (payment) {
    // If payment is for an appointment, update appointment to confirmed (ready for barber)
    if (payment.agendamento_id) {
      const { error: appointmentError } = await supabase
        .from('agendamentos')
        .update({ 
          status: 'confirmed',
          observacoes: 'Pagamento confirmado - Aguardando confirmação do barbeiro'
        })
        .eq('id', payment.agendamento_id);

      if (appointmentError) {
        console.error('Error updating appointment:', appointmentError);
      } else {
        console.log(`Appointment ${payment.agendamento_id} marked as confirmed`);
      }
    }

    // If payment is for a subscription, activate it and unblock user
    if (payment.assinatura_id) {
      const { error: subscriptionError } = await supabase
        .from('assinaturas')
        .update({ status: 'active' })
        .eq('id', payment.assinatura_id);

      if (subscriptionError) {
        console.error('Error activating subscription:', subscriptionError);
      } else {
        console.log(`Subscription ${payment.assinatura_id} activated`);

        // Unblock user
        const { error: unblockError } = await supabase
          .from('profiles')
          .update({ blocked: false })
          .eq('id', payment.user_id);

        if (unblockError) {
          console.error('Error unblocking user:', unblockError);
        } else {
          console.log(`User ${payment.user_id} unblocked after subscription payment`);
        }
      }
    }
  }

  // Also check if this payment is linked to a subscription directly via subscription ID
  // (for first payments of PIX subscriptions)
  if (payload.payment.subscription) {
    const { data: subscription } = await supabase
      .from('assinaturas')
      .select('id, user_id, status')
      .eq('gateway_subscription_id', payload.payment.subscription)
      .maybeSingle();

    if (subscription && subscription.status === 'suspended') {
      console.log('Activating suspended PIX subscription after first payment:', subscription.id);

      const { error: activateError } = await supabase
        .from('assinaturas')
        .update({ status: 'active' })
        .eq('id', subscription.id);

      if (activateError) {
        console.error('Error activating PIX subscription:', activateError);
      } else {
        console.log(`PIX subscription ${subscription.id} activated`);

        // Unblock user
        const { error: unblockError } = await supabase
          .from('profiles')
          .update({ blocked: false })
          .eq('id', subscription.user_id);

        if (unblockError) {
          console.error('Error unblocking user after PIX subscription:', unblockError);
        } else {
          console.log(`User ${subscription.user_id} unblocked after PIX subscription payment`);
        }
      }
    }
  }

  console.log('Payment confirmed successfully');
}

async function handlePaymentOverdue(supabase: any, payload: AsaasWebhookEvent) {
  if (!payload.payment) return;

  console.log(`Processing overdue payment: ${payload.payment.id}`);

  const { error } = await supabase
    .from('pagamentos')
    .update({ status: 'overdue' })
    .eq('gateway_payment_id', payload.payment.id);

  if (error) {
    console.error('Error updating overdue payment:', error);
  }

  // Block user if it's a subscription payment
  const { data: payment } = await supabase
    .from('pagamentos')
    .select('user_id, assinatura_id')
    .eq('gateway_payment_id', payload.payment.id)
    .single();

  if (payment?.assinatura_id) {
    await supabase
      .from('profiles')
      .update({ blocked: true })
      .eq('id', payment.user_id);

    console.log(`User ${payment.user_id} blocked due to overdue subscription`);
  }
}

async function handlePaymentCancelled(supabase: any, payload: AsaasWebhookEvent) {
  if (!payload.payment) return;

  console.log(`Processing cancelled/refunded payment: ${payload.payment.id}`);

  const { error } = await supabase
    .from('pagamentos')
    .update({ status: 'cancelled' })
    .eq('gateway_payment_id', payload.payment.id);

  if (error) {
    console.error('Error cancelling payment:', error);
  }
}

async function handlePaymentCreated(supabase: any, payload: AsaasWebhookEvent) {
  if (!payload.payment) return;

  console.log(`Payment created: ${payload.payment.id}`);
  // Payment is already created in the system, just log the event
}

async function handlePaymentPending(supabase: any, payload: AsaasWebhookEvent) {
  if (!payload.payment) return;

  console.log(`Processing pending payment: ${payload.payment.id}`);

  const { error } = await supabase
    .from('pagamentos')
    .update({ status: 'pending' })
    .eq('gateway_payment_id', payload.payment.id);

  if (error) {
    console.error('Error updating pending payment:', error);
  }
}

async function handlePaymentFailed(supabase: any, payload: AsaasWebhookEvent) {
  if (!payload.payment) return;

  console.log(`Processing failed payment: ${payload.payment.id}`);

  const { error } = await supabase
    .from('pagamentos')
    .update({ status: 'failed' })
    .eq('gateway_payment_id', payload.payment.id);

  if (error) {
    console.error('Error updating failed payment:', error);
  }
}

async function handleSubscriptionCreated(supabase: any, payload: AsaasWebhookEvent) {
  if (!payload.subscription) return;

  console.log(`Subscription created: ${payload.subscription.id}`);
  // Subscription is already created in the system, just log
}

async function handleSubscriptionUpdated(supabase: any, payload: AsaasWebhookEvent) {
  if (!payload.subscription) return;

  console.log(`Subscription updated: ${payload.subscription.id}`);

  const statusMap: { [key: string]: string } = {
    'ACTIVE': 'active',
    'INACTIVE': 'cancelled',
    'EXPIRED': 'expired',
  };

  const newStatus = statusMap[payload.subscription.status] || 'active';

  const { error } = await supabase
    .from('assinaturas')
    .update({
      status: newStatus,
      next_billing_date: payload.subscription.nextDueDate,
    })
    .eq('gateway_subscription_id', payload.subscription.id);

  if (error) {
    console.error('Error updating subscription:', error);
  }
}

// Helper function to send webhook events
async function sendWebhookEvent(supabase: any, eventData: any): Promise<void> {
  try {
    // Buscar configuração do webhook
    const { data: config } = await supabase
      .from('webhook_config')
      .select('webhook_url, ativo')
      .single();

    if (!config?.webhook_url || !config?.ativo) {
      console.log('[sendWebhookEvent] Webhook não configurado ou inativo');
      return;
    }

    const payload = {
      ...eventData,
      timestamp: new Date().toISOString()
    };

    console.log('[sendWebhookEvent] Enviando evento:', eventData.evento);

    const response = await fetch(config.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.log('[sendWebhookEvent] Evento enviado com sucesso');
    } else {
      console.error('[sendWebhookEvent] Erro ao enviar:', response.status);
    }
  } catch (error) {
    console.error('[sendWebhookEvent] Erro:', error);
  }
}
