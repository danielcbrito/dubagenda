import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreatePaymentRequest {
  agendamentoId: string;
  metodo: 'card' | 'pix' | 'cash';
  customerInfo?: {
    name: string;
    email: string;
    cpf: string;
  };
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
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticating user...');
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('Authentication failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', user.id);

    const { agendamentoId, metodo, customerInfo, cardInfo }: CreatePaymentRequest = await req.json();

    console.log('Received payment request:', { agendamentoId, metodo, hasCustomerInfo: !!customerInfo, hasCardInfo: !!cardInfo });

    // Fetch appointment details
    const { data: appointment, error: aptError } = await supabase
      .from('agendamentos')
      .select('*')
      .eq('id', agendamentoId)
      .eq('user_id', user.id)
      .single();
 
    if (aptError || !appointment) {
      console.error('Appointment not found or not owned by user:', { agendamentoId, userId: user.id, error: aptError?.message });
      return new Response(
        JSON.stringify({ error: 'Agendamento não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
 
    // Fetch user profile for name and CPF used in Asaas
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('nome, cpf')
      .eq('id', user.id)
      .single();
 
    if (profileError || !profile) {
      console.warn('Profile not found for user, proceeding with limited data:', { userId: user.id, error: profileError?.message });
    }

    // Handle different payment methods
    if (metodo === 'cash') {
      // For cash payments, just create a pending payment record
      const { data: payment, error: paymentError } = await supabase
        .from('pagamentos')
        .insert({
          user_id: user.id,
          agendamento_id: agendamentoId,
          metodo: 'cash',
          valor: appointment.preco,
          status: 'pending',
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      return new Response(
        JSON.stringify({
          success: true,
          paymentMethod: 'cash',
          payment,
          message: 'Pagamento em dinheiro registrado. Pague na barbearia.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For PIX and Card, integrate with Asaas
    const asaasApiKey = Deno.env.get('ASAAS_API_KEY');
    if (!asaasApiKey) {
      throw new Error('Asaas API key not configured');
    }

    // Get or create customer in Asaas
    const customerData = {
      name: customerInfo?.name || profile?.nome || user.email || 'Cliente',
      email: user.email,
      cpfCnpj: (customerInfo?.cpf || profile?.cpf || '')?.replace(/\D/g, ''),
      externalReference: user.id,
    };

    console.log('Creating/fetching Asaas customer:', { ...customerData, cpfCnpj: '[REDACTED]' });

    // Try to find existing customer first
    let asaasCustomerId;
    const customerSearchResponse = await fetch(
      `https://sandbox.asaas.com/api/v3/customers?externalReference=${user.id}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'access_token': asaasApiKey,
        },
      }
    );

    const customerSearchResult = await customerSearchResponse.json();
    console.log('Customer search result:', { 
      found: customerSearchResult.data?.length > 0,
      count: customerSearchResult.data?.length 
    });

    if (customerSearchResult.data && customerSearchResult.data.length > 0) {
      asaasCustomerId = customerSearchResult.data[0].id;
      console.log('Using existing customer:', asaasCustomerId);
    } else {
      // Create new customer
      const customerCreateResponse = await fetch('https://sandbox.asaas.com/api/v3/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': asaasApiKey,
        },
        body: JSON.stringify(customerData),
      });

      const customerCreateResult = await customerCreateResponse.json();
      console.log('Customer creation result:', { 
        status: customerCreateResponse.status,
        hasId: !!customerCreateResult.id,
        hasError: !!customerCreateResult.errors 
      });

      if (!customerCreateResponse.ok || customerCreateResult.errors) {
        console.error('Asaas customer error:', customerCreateResult);
        throw new Error(customerCreateResult.errors?.[0]?.description || 'Erro ao criar cliente no Asaas');
      }

      asaasCustomerId = customerCreateResult.id;
      console.log('Created new customer:', asaasCustomerId);
    }

    // Create payment in Asaas
    const paymentData: any = {
      customer: asaasCustomerId,
      billingType: metodo === 'pix' ? 'PIX' : 'CREDIT_CARD',
      value: appointment.preco,
      dueDate: new Date().toISOString().split('T')[0],
      description: `Agendamento #${agendamentoId.substring(0, 8)}`,
      externalReference: agendamentoId,
    };

    // For credit card, add card info
    if (metodo === 'card') {
      if (!cardInfo) {
        console.error('Missing card info for card payment');
        return new Response(
          JSON.stringify({ error: 'Dados do cartão obrigatórios para pagamento com cartão' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      paymentData.creditCard = {
        holderName: cardInfo.holderName,
        number: cardInfo.number.replace(/\s/g, ''),
        expiryMonth: cardInfo.expiryMonth,
        expiryYear: cardInfo.expiryYear,
        ccv: cardInfo.ccv,
      };
      paymentData.creditCardHolderInfo = {
        name: cardInfo.holderName,
        email: user.email,
        cpfCnpj: (customerData.cpfCnpj || '').replace(/\D/g, ''),
        postalCode: '00000000',
        addressNumber: '0',
        phone: '0000000000',
      };
    }

    console.log('Creating Asaas payment:', { 
      customer: asaasCustomerId,
      billingType: paymentData.billingType,
      value: paymentData.value,
      hasCard: metodo === 'card' 
    });

    const asaasResponse = await fetch('https://sandbox.asaas.com/api/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': asaasApiKey,
      },
      body: JSON.stringify(paymentData),
    });

    const asaasResult = await asaasResponse.json();

    console.log('Asaas payment response:', { 
      status: asaasResponse.status, 
      id: asaasResult.id,
      hasError: !!asaasResult.errors,
      errorMessage: asaasResult.errors?.[0]?.description || asaasResult.message
    });

    if (!asaasResponse.ok || asaasResult.errors) {
      console.error('Asaas payment error:', JSON.stringify(asaasResult, null, 2));
      throw new Error(asaasResult.errors?.[0]?.description || asaasResult.message || 'Erro ao processar pagamento no Asaas');
    }

    // Save payment to database
    const { data: payment, error: paymentError } = await supabase
      .from('pagamentos')
      .insert({
        user_id: user.id,
        agendamento_id: agendamentoId,
        metodo: metodo,
        valor: appointment.preco,
        status: metodo === 'card' ? 'paid' : 'pending', // Card is instant, PIX is pending
        gateway_payment_id: asaasResult.id,
      })
      .select()
      .single();

    if (paymentError) throw paymentError;

    // If card payment was successful, update appointment status
    if (metodo === 'card') {
      await supabase
        .from('agendamentos')
        .update({ status: 'confirmed' })
        .eq('id', agendamentoId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        paymentMethod: metodo,
        payment,
        asaasPayment: {
          id: asaasResult.id,
          status: asaasResult.status,
          invoiceUrl: asaasResult.invoiceUrl,
          pixQrCode: metodo === 'pix' ? {
            encodedImage: asaasResult.encodedImage,
            payload: asaasResult.payload,
            expirationDate: asaasResult.expirationDate,
          } : undefined,
        },
        message: metodo === 'pix' 
          ? 'PIX gerado com sucesso! Escaneie o QR Code para pagar.'
          : 'Pagamento processado com sucesso!',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in create-payment:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro ao processar pagamento',
        details: error.toString()
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
