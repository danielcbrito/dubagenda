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
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { agendamentoId, metodo, customerInfo, cardInfo }: CreatePaymentRequest = await req.json();

    // Fetch appointment details
    const { data: appointment, error: aptError } = await supabase
      .from('agendamentos')
      .select('*, profiles!inner(nome, cpf)')
      .eq('id', agendamentoId)
      .eq('user_id', user.id)
      .single();

    if (aptError || !appointment) {
      throw new Error('Agendamento não encontrado');
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
      name: customerInfo?.name || appointment.profiles.nome,
      email: user.email,
      cpfCnpj: customerInfo?.cpf || appointment.profiles.cpf,
    };

    // Create payment in Asaas
    const paymentData: any = {
      customer: user.id, // Use Supabase user ID as external reference
      billingType: metodo === 'pix' ? 'PIX' : 'CREDIT_CARD',
      value: appointment.preco,
      dueDate: new Date().toISOString().split('T')[0],
      description: `Agendamento #${agendamentoId.substring(0, 8)}`,
      externalReference: agendamentoId,
    };

    // For credit card, add card info
    if (metodo === 'card' && cardInfo) {
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
        cpfCnpj: customerData.cpfCnpj,
        postalCode: '00000000',
        addressNumber: '0',
        phone: '0000000000',
      };
    }

    console.log('Creating Asaas payment:', { ...paymentData, creditCard: metodo === 'card' ? '[REDACTED]' : undefined });

    const asaasResponse = await fetch('https://sandbox.asaas.com/api/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': asaasApiKey,
      },
      body: JSON.stringify(paymentData),
    });

    const asaasResult = await asaasResponse.json();

    console.log('Asaas response:', { 
      status: asaasResponse.status, 
      id: asaasResult.id,
      hasError: !!asaasResult.errors 
    });

    if (!asaasResponse.ok || asaasResult.errors) {
      console.error('Asaas error:', asaasResult);
      throw new Error(asaasResult.errors?.[0]?.description || 'Erro ao processar pagamento no Asaas');
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
