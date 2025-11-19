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

  // Update payment status in database
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
    .single();

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

    // If payment is for subscription, unblock user
    if (payment.assinatura_id) {
      await supabase
        .from('profiles')
        .update({ blocked: false })
        .eq('id', payment.user_id);

      console.log(`User ${payment.user_id} unblocked after subscription payment`);
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
