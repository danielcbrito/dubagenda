import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateSubscriptionRequest {
  planoId: string;
  paymentMethod: 'card' | 'pix';
  cardInfo?: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { planoId, paymentMethod, cardInfo }: CreateSubscriptionRequest = await req.json();

    // Fetch plan details
    const { data: plano, error: planoError } = await supabase
      .from('planos')
      .select('*')
      .eq('id', planoId)
      .eq('ativo', true)
      .single();

    if (planoError || !plano) {
      throw new Error('Plano não encontrado');
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Perfil não encontrado');
    }

    // Check if user is blocked
    if (profile.blocked) {
      throw new Error('Usuário bloqueado. Entre em contato com o suporte.');
    }

    // Check if user already has an active subscription
    const { data: existingSubscription } = await supabase
      .from('assinaturas')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (existingSubscription) {
      throw new Error('Você já possui uma assinatura ativa');
    }

    const asaasApiKey = Deno.env.get('ASAAS_API_KEY');
    if (!asaasApiKey) {
      throw new Error('Asaas API key not configured');
    }

    // Create subscription in Asaas
    const subscriptionData: any = {
      customer: user.id,
      billingType: paymentMethod === 'pix' ? 'PIX' : 'CREDIT_CARD',
      value: plano.preco_mensal,
      nextDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
      cycle: 'MONTHLY',
      description: `Assinatura ${plano.nome}`,
      externalReference: user.id,
    };

    // For credit card, add card info
    if (paymentMethod === 'card' && cardInfo) {
      subscriptionData.creditCard = {
        holderName: cardInfo.holderName,
        number: cardInfo.number.replace(/\s/g, ''),
        expiryMonth: cardInfo.expiryMonth,
        expiryYear: cardInfo.expiryYear,
        ccv: cardInfo.ccv,
      };
      subscriptionData.creditCardHolderInfo = {
        name: cardInfo.holderName,
        email: user.email,
        cpfCnpj: profile.cpf || '00000000000',
        postalCode: '00000000',
        addressNumber: '0',
        phone: '0000000000',
      };
    }

    console.log('Creating Asaas subscription:', { 
      ...subscriptionData, 
      creditCard: paymentMethod === 'card' ? '[REDACTED]' : undefined 
    });

    const asaasResponse = await fetch('https://sandbox.asaas.com/api/v3/subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': asaasApiKey,
      },
      body: JSON.stringify(subscriptionData),
    });

    const asaasResult = await asaasResponse.json();

    console.log('Asaas subscription response:', { 
      status: asaasResponse.status, 
      id: asaasResult.id,
      hasError: !!asaasResult.errors 
    });

    if (!asaasResponse.ok || asaasResult.errors) {
      console.error('Asaas error:', asaasResult);
      throw new Error(asaasResult.errors?.[0]?.description || 'Erro ao criar assinatura no Asaas');
    }

    // Calculate next billing date
    const nextBillingDate = new Date(asaasResult.nextDueDate);

    // Save subscription to database
    const { data: subscription, error: subscriptionError } = await supabase
      .from('assinaturas')
      .insert({
        user_id: user.id,
        plano_id: planoId,
        status: 'active',
        payment_method: paymentMethod,
        gateway_subscription_id: asaasResult.id,
        next_billing_date: nextBillingDate.toISOString().split('T')[0],
      })
      .select()
      .single();

    if (subscriptionError) throw subscriptionError;

    // Unblock user if they were blocked
    if (profile.blocked) {
      await supabase
        .from('profiles')
        .update({ blocked: false })
        .eq('id', user.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        subscription,
        asaasSubscription: {
          id: asaasResult.id,
          status: asaasResult.status,
          nextDueDate: asaasResult.nextDueDate,
        },
        message: 'Assinatura criada com sucesso!',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in create-subscription:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro ao criar assinatura',
        details: error.toString()
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
