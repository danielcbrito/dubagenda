import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Edge function para gerenciar forma de pagamento da assinatura
 * - GET: Busca dados do cartão cadastrado no Asaas
 * - PUT: Atualiza o cartão de crédito da assinatura
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const asaasApiKey = Deno.env.get('ASAAS_API_KEY');
    if (!asaasApiKey) {
      throw new Error('ASAAS_API_KEY not configured');
    }

    // Autenticar usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determinar ação: via body.action ou fallback para "get"
    let action = 'get';
    let body: any = {};

    try {
      body = await req.json();
      action = body.action || 'get';
    } catch {
      // Body vazio = GET
      action = 'get';
    }

    // Buscar assinatura ativa do usuário
    const { data: subscription, error: subError } = await supabase
      .from('assinaturas')
      .select('*, planos(*)')
      .eq('user_id', user.id)
      .in('status', ['active', 'suspended'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError) throw subError;

    if (!subscription) {
      return new Response(
        JSON.stringify({ error: 'Nenhuma assinatura encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== GET: Buscar dados de pagamento ==========
    if (action === 'get') {
      let cardInfo = null;

      if (subscription.gateway_subscription_id) {
        try {
          const asaasResponse = await fetch(
            `https://api.asaas.com/v3/subscriptions/${subscription.gateway_subscription_id}`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'access_token': asaasApiKey,
              },
            }
          );

          if (asaasResponse.ok) {
            const asaasData = await asaasResponse.json();
            
            if (asaasData.creditCard) {
              cardInfo = {
                brand: asaasData.creditCard.creditCardBrand || null,
                lastFourDigits: asaasData.creditCard.creditCardNumber || null,
                holderName: asaasData.creditCard.creditCardHolderName || null,
              };
            }
          }
        } catch (err) {
          console.error('Error fetching Asaas subscription details:', err);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          subscription: {
            id: subscription.id,
            status: subscription.status,
            payment_method: subscription.payment_method,
            next_billing_date: subscription.next_billing_date,
            gateway_subscription_id: subscription.gateway_subscription_id,
            plano: subscription.planos,
          },
          cardInfo,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== UPDATE: Atualizar cartão ou trocar para PIX ==========
    if (action === 'update') {
      const { cardInfo, changeToMethod } = body;

      // Buscar perfil do usuário para CPF
      const { data: profile } = await supabase
        .from('profiles')
        .select('nome, cpf')
        .eq('id', user.id)
        .single();

      if (!subscription.gateway_subscription_id) {
        return new Response(
          JSON.stringify({ error: 'Assinatura sem vínculo com gateway de pagamento' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Trocar para cartão com novos dados
      if (changeToMethod === 'card' && cardInfo) {
        const updateData: any = {
          billingType: 'CREDIT_CARD',
          creditCard: {
            holderName: cardInfo.holderName,
            number: cardInfo.number.replace(/\s/g, ''),
            expiryMonth: cardInfo.expiryMonth,
            expiryYear: cardInfo.expiryYear,
            ccv: cardInfo.ccv,
          },
          creditCardHolderInfo: {
            name: cardInfo.holderName,
            email: user.email,
            cpfCnpj: profile?.cpf || '00000000000',
            postalCode: '00000000',
            addressNumber: '0',
            phone: '0000000000',
          },
        };

        console.log('Updating Asaas subscription card:', subscription.gateway_subscription_id);

        const asaasResponse = await fetch(
          `https://api.asaas.com/v3/subscriptions/${subscription.gateway_subscription_id}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'access_token': asaasApiKey,
            },
            body: JSON.stringify(updateData),
          }
        );

        const asaasResult = await asaasResponse.json();

        if (!asaasResponse.ok || asaasResult.errors) {
          console.error('Asaas update error:', asaasResult);
          return new Response(
            JSON.stringify({ 
              error: asaasResult.errors?.[0]?.description || 'Erro ao atualizar cartão no gateway' 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Atualizar método de pagamento no banco
        await supabase
          .from('assinaturas')
          .update({ 
            payment_method: 'card',
            status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('id', subscription.id);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Cartão atualizado com sucesso',
            cardInfo: {
              brand: asaasResult.creditCard?.creditCardBrand || null,
              lastFourDigits: asaasResult.creditCard?.creditCardNumber || null,
              holderName: cardInfo.holderName,
            }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Trocar para PIX
      if (changeToMethod === 'pix') {
        const asaasResponse = await fetch(
          `https://api.asaas.com/v3/subscriptions/${subscription.gateway_subscription_id}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'access_token': asaasApiKey,
            },
            body: JSON.stringify({ billingType: 'PIX' }),
          }
        );

        const asaasResult = await asaasResponse.json();

        if (!asaasResponse.ok || asaasResult.errors) {
          console.error('Asaas update error:', asaasResult);
          return new Response(
            JSON.stringify({ 
              error: asaasResult.errors?.[0]?.description || 'Erro ao alterar para PIX' 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await supabase
          .from('assinaturas')
          .update({ 
            payment_method: 'pix',
            updated_at: new Date().toISOString(),
          })
          .eq('id', subscription.id);

        return new Response(
          JSON.stringify({ success: true, message: 'Forma de pagamento alterada para PIX' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Parâmetros inválidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Ação não suportada' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in manage-subscription-payment:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
