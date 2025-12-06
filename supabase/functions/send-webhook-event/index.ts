import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Interface completa para payload de webhook
 * Contém TODOS os dados relevantes para integração externa
 */
interface WebhookEventPayload {
  // Identificação do evento
  evento: string;
  evento_id?: string;
  descricao?: string;
  timestamp: string;

  // Dados do agendamento
  agendamento_id?: string;
  data?: string;
  hora?: string;
  duracao_minutos?: number;
  status?: string;
  tipo_agendamento?: string;
  observacoes?: string;

  // Dados do serviço
  servico_id?: string;
  servico?: string;
  
  // Dados financeiros
  preco?: number;
  valor_total?: number;
  valor_pago_app?: number;
  valor_pago_creditos?: number;
  metodo_pagamento?: string;
  saldo_creditos_restante?: number;

  // Dados do cliente
  cliente_id?: string;
  cliente_nome?: string;
  cliente_telefone?: string;
  cliente_email?: string;
  cliente_cpf?: string;

  // Dados do barbeiro
  barbeiro_id?: string;
  barbeiro_nome?: string;

  // Mensagens e detalhes extras
  mensagem_barbeiro?: string;
  mensagem?: string;
  motivo?: string;
  detalhes?: Record<string, unknown>;
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
    console.log('[send-webhook-event] Cliente:', payload.cliente_nome, '| Telefone:', payload.cliente_telefone);

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

    // Garantir timestamp e evento_id
    const eventPayload = {
      ...payload,
      evento_id: payload.evento_id || crypto.randomUUID(),
      timestamp: payload.timestamp || new Date().toISOString()
    };

    // Se temos cliente_id mas falta dados do cliente, buscar
    if (eventPayload.cliente_id && (!eventPayload.cliente_nome || !eventPayload.cliente_telefone)) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('nome, telefone, cpf')
          .eq('id', eventPayload.cliente_id)
          .single();
        
        if (profile) {
          eventPayload.cliente_nome = eventPayload.cliente_nome || profile.nome;
          eventPayload.cliente_telefone = eventPayload.cliente_telefone || profile.telefone;
          eventPayload.cliente_cpf = eventPayload.cliente_cpf || profile.cpf;
        }
      } catch (e) {
        console.warn('[send-webhook-event] Não foi possível buscar dados do cliente:', e);
      }
    }

    // Se temos barbeiro_id mas falta nome, buscar
    if (eventPayload.barbeiro_id && !eventPayload.barbeiro_nome) {
      try {
        const { data: barbeiro } = await supabase
          .from('barbeiros')
          .select('apelido')
          .eq('id', eventPayload.barbeiro_id)
          .single();
        
        if (barbeiro) {
          eventPayload.barbeiro_nome = barbeiro.apelido;
        }
      } catch (e) {
        console.warn('[send-webhook-event] Não foi possível buscar dados do barbeiro:', e);
      }
    }

    // Se temos agendamento_id mas falta dados, buscar
    if (eventPayload.agendamento_id && (!eventPayload.servico || !eventPayload.data || !eventPayload.hora)) {
      try {
        const { data: agendamento } = await supabase
          .from('agendamentos')
          .select(`
            data, hora, duracao, preco, status, tipo_agendamento, observacoes,
            servico_id, barbeiro_id,
            servicos:servico_id (nome)
          `)
          .eq('id', eventPayload.agendamento_id)
          .single();
        
        if (agendamento) {
          eventPayload.data = eventPayload.data || agendamento.data;
          eventPayload.hora = eventPayload.hora || agendamento.hora;
          eventPayload.duracao_minutos = eventPayload.duracao_minutos || agendamento.duracao;
          eventPayload.preco = eventPayload.preco || agendamento.preco;
          eventPayload.valor_total = eventPayload.valor_total || agendamento.preco;
          eventPayload.status = eventPayload.status || agendamento.status;
          eventPayload.tipo_agendamento = eventPayload.tipo_agendamento || agendamento.tipo_agendamento;
          eventPayload.observacoes = eventPayload.observacoes || agendamento.observacoes;
          eventPayload.servico_id = eventPayload.servico_id || agendamento.servico_id;
          eventPayload.barbeiro_id = eventPayload.barbeiro_id || agendamento.barbeiro_id;
          
          if (agendamento.servicos && typeof agendamento.servicos === 'object') {
            const servico = agendamento.servicos as { nome?: string };
            eventPayload.servico = eventPayload.servico || servico.nome;
          }
        }
      } catch (e) {
        console.warn('[send-webhook-event] Não foi possível buscar dados do agendamento:', e);
      }
    }

    console.log('[send-webhook-event] Enviando para:', config.webhook_url);
    console.log('[send-webhook-event] Payload completo:', JSON.stringify(eventPayload, null, 2));

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
          evento_id: eventPayload.evento_id,
          cliente_id: payload.cliente_id,
          cliente_telefone: eventPayload.cliente_telefone,
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
        evento_id: eventPayload.evento_id,
        agendamento_id: payload.agendamento_id,
        cliente_id: payload.cliente_id,
        cliente_telefone: eventPayload.cliente_telefone
      }
    });

    return new Response(
      JSON.stringify({ success: true, evento_id: eventPayload.evento_id }),
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
