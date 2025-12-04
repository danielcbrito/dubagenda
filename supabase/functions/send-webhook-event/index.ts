import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookEventPayload {
  evento: string;
  agendamento_id?: string;
  cliente_id?: string;
  cliente_nome?: string;
  cliente_telefone?: string;
  barbeiro_id?: string;
  servico?: string;
  data?: string;
  hora?: string;
  preco?: number;
  status?: string;
  mensagem_barbeiro?: string;
  mensagem?: string;
  timestamp: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: WebhookEventPayload = await req.json();
    
    console.log('[send-webhook-event] Recebido evento:', payload.evento);

    // Buscar configuração do webhook
    const { data: config, error: configError } = await supabase
      .from('webhook_config')
      .select('webhook_url, ativo')
      .single();

    if (configError) {
      console.error('[send-webhook-event] Erro ao buscar config:', configError);
      return new Response(
        JSON.stringify({ success: false, error: 'Configuração de webhook não encontrada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (!config?.webhook_url || !config?.ativo) {
      console.log('[send-webhook-event] Webhook não configurado ou inativo');
      return new Response(
        JSON.stringify({ success: false, error: 'Webhook não configurado ou inativo' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Adicionar timestamp se não existir
    const eventPayload = {
      ...payload,
      timestamp: payload.timestamp || new Date().toISOString()
    };

    console.log('[send-webhook-event] Enviando para:', config.webhook_url);
    console.log('[send-webhook-event] Payload:', JSON.stringify(eventPayload, null, 2));

    // Enviar evento para o webhook
    const webhookResponse = await fetch(config.webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventPayload),
    });

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      console.error('[send-webhook-event] Erro do webhook:', webhookResponse.status, errorText);
      
      // Registrar erro no log
      await supabase.from('system_logs').insert({
        level: 'error',
        category: 'webhook',
        message: `Falha ao enviar evento ${payload.evento}`,
        details: {
          evento: payload.evento,
          status_code: webhookResponse.status,
          error: errorText,
          webhook_url: config.webhook_url.substring(0, 50) + '...'
        }
      });

      return new Response(
        JSON.stringify({ success: false, error: `Webhook retornou status ${webhookResponse.status}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log('[send-webhook-event] Evento enviado com sucesso!');

    // Registrar sucesso no log
    await supabase.from('system_logs').insert({
      level: 'info',
      category: 'webhook',
      message: `Evento ${payload.evento} enviado com sucesso`,
      details: {
        evento: payload.evento,
        agendamento_id: payload.agendamento_id
      }
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[send-webhook-event] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
