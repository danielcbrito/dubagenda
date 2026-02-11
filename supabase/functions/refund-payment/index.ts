import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Edge Function: refund-payment
 * 
 * Realiza estorno automático de pagamentos via Asaas (PIX e Cartão de Crédito).
 * Chamada quando o cliente cancela um agendamento já pago.
 * 
 * Payload esperado:
 * - agendamento_id: ID do agendamento a ser estornado
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const asaasApiKey = Deno.env.get('ASAAS_API_KEY');
    
    if (!asaasApiKey) {
      throw new Error('ASAAS_API_KEY não configurada');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Autenticação do usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const { agendamento_id } = await req.json();
    
    if (!agendamento_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'agendamento_id é obrigatório' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`[refund-payment] Iniciando estorno para agendamento: ${agendamento_id}`);

    // Buscar pagamento associado ao agendamento
    const { data: pagamento, error: pagError } = await supabase
      .from('pagamentos')
      .select('id, gateway_payment_id, status, metodo, valor')
      .eq('agendamento_id', agendamento_id)
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pagError) {
      console.error('[refund-payment] Erro ao buscar pagamento:', pagError);
      throw new Error('Erro ao buscar pagamento');
    }

    if (!pagamento || !pagamento.gateway_payment_id) {
      console.log('[refund-payment] Nenhum pagamento pago encontrado para estorno');
      return new Response(
        JSON.stringify({ 
          success: true, 
          refunded: false, 
          message: 'Nenhum pagamento encontrado para estorno' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[refund-payment] Pagamento encontrado: ${pagamento.gateway_payment_id} | Método: ${pagamento.metodo} | Valor: R$ ${pagamento.valor}`);

    // Chamar API Asaas para estorno
    const refundResponse = await fetch(
      `https://api.asaas.com/v3/payments/${pagamento.gateway_payment_id}/refund`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': asaasApiKey,
        },
      }
    );

    const refundData = await refundResponse.json();

    if (!refundResponse.ok) {
      console.error('[refund-payment] Erro no estorno Asaas:', refundResponse.status, JSON.stringify(refundData));
      
      // Registrar falha no log
      await supabase.from('system_logs').insert({
        level: 'error',
        category: 'refund',
        message: `Falha no estorno do pagamento ${pagamento.gateway_payment_id}`,
        details: {
          agendamento_id,
          gateway_payment_id: pagamento.gateway_payment_id,
          status_code: refundResponse.status,
          error: refundData,
        }
      });

      // Mesmo com falha no gateway, criar crédito interno como fallback
      await supabase.from('creditos').insert({
        user_id: user.id,
        valor: pagamento.valor,
        origem: 'estorno_cancelamento',
        agendamento_origem_id: agendamento_id,
        usado: false,
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          refunded: true,
          refund_type: 'credit',
          message: `Estorno via gateway falhou. R$ ${pagamento.valor.toFixed(2)} adicionado como crédito.`,
          valor: pagamento.valor,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[refund-payment] Estorno Asaas realizado com sucesso:', JSON.stringify(refundData));

    // Atualizar status do pagamento
    await supabase
      .from('pagamentos')
      .update({ status: 'refunded' })
      .eq('id', pagamento.id);

    // Registrar sucesso no log
    await supabase.from('system_logs').insert({
      level: 'info',
      category: 'refund',
      message: `Estorno realizado com sucesso: ${pagamento.gateway_payment_id}`,
      details: {
        agendamento_id,
        gateway_payment_id: pagamento.gateway_payment_id,
        metodo: pagamento.metodo,
        valor: pagamento.valor,
        refund_data: refundData,
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        refunded: true,
        refund_type: 'gateway',
        message: `Estorno de R$ ${pagamento.valor.toFixed(2)} realizado com sucesso.`,
        valor: pagamento.valor,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[refund-payment] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
