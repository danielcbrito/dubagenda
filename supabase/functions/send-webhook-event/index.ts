import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Formata o número de telefone no padrão WhatsApp: NUMERO@s.whatsapp.net
 * - Remove tudo que não for número
 * - Adiciona DDI 55 se não tiver
 * - Nunca coloca +
 * - Sempre termina com @s.whatsapp.net
 */
function formatPhoneForWhatsApp(phone: string | null | undefined): string {
  if (!phone) return '';
  
  // Remove tudo que não for número
  let cleaned = phone.replace(/\D/g, '');
  
  // Se o número estiver vazio após limpeza, retorna vazio
  if (!cleaned) return '';
  
  // Se não começar com 55 (DDI Brasil), adiciona
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }
  
  // Retorna no formato WhatsApp
  return `${cleaned}@s.whatsapp.net`;
}

interface WhatsAppInstanceRecord {
  barbeiro_id: string;
  instance_name: string | null;
  api_key: string | null;
  status: string;
  connected_at?: string | null;
  created_at?: string | null;
  barbeiro_nome?: string | null;
}

function normalizeLookupText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function extractTenantId(details: Record<string, unknown> | undefined): string | null {
  const tenantId = details?.tenant_id;
  return typeof tenantId === 'string' && tenantId.length > 0 ? tenantId : null;
}

function choosePrimaryTenantInstance(instances: WhatsAppInstanceRecord[]): WhatsAppInstanceRecord | null {
  const connectedInstances = instances.filter(
    (instance) => instance.status === 'connected' && instance.instance_name && instance.api_key,
  );

  if (connectedInstances.length === 0) {
    return null;
  }

  connectedInstances.sort((a, b) => {
    const aPriority = normalizeLookupText(a.barbeiro_nome).includes('tulio') ? 0 : 1;
    const bPriority = normalizeLookupText(b.barbeiro_nome).includes('tulio') ? 0 : 1;

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    const aDate = a.connected_at || a.created_at || '';
    const bDate = b.connected_at || b.created_at || '';

    if (aDate !== bDate) {
      return aDate.localeCompare(bDate);
    }

    return (a.instance_name || '').localeCompare(b.instance_name || '');
  });

  return connectedInstances[0];
}

function resolveWebhookUrl(
  config: {
    webhook_url: string | null;
    ativo: boolean | null;
    confirmacao_webhook_url: string | null;
    confirmacao_ativo: boolean | null;
    lembrete_webhook_url: string | null;
    lembrete_ativo: boolean | null;
  },
  evento: string,
): string | null {
  const isReminderEvent = evento === 'lembrete_agendamento' || evento.startsWith('reminder_') || evento.includes('lembrete');

  if (isReminderEvent && config.lembrete_ativo && config.lembrete_webhook_url) {
    return config.lembrete_webhook_url;
  }

  if (config.ativo && config.webhook_url) {
    return config.webhook_url;
  }

  if (evento === 'agendamento_confirmado' && config.confirmacao_ativo && config.confirmacao_webhook_url) {
    return config.confirmacao_webhook_url;
  }

  return null;
}

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
  cliente_telefone_whatsapp?: string; // Formato: NUMERO@s.whatsapp.net
  cliente_email?: string;
  cliente_cpf?: string;

  // Dados do barbeiro
  barbeiro_id?: string;
  barbeiro_nome?: string;

  // Mensagens e detalhes extras
  mensagem_barbeiro?: string;
  mensagem?: string; // Mensagem pronta para enviar ao cliente
  motivo?: string;
  detalhes?: Record<string, unknown>;
}

/**
 * Gera mensagem personalizada baseada no evento
 */
function gerarMensagemPersonalizada(evento: string, payload: WebhookEventPayload): string {
  const nome = payload.cliente_nome?.split(' ')[0] || 'Cliente';
  const data = payload.data ? new Date(payload.data + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }) : '';
  const hora = payload.hora || '';
  const servico = payload.servico || 'seu serviço';
  const preco = payload.preco ? `R$ ${payload.preco.toFixed(2)}` : '';

  // Single \n separators to avoid being split into multiple WhatsApp messages
  switch (evento) {
    case 'agendamento_criado':
      return `📋 *Novo agendamento recebido!*\nOlá ${nome}! Recebemos seu pedido para o dia ${data} às ${hora}.\nAguarde a confirmação do barbeiro. 🔔`;
    
    case 'agendamento_confirmado':
      return `✅ *Agendamento Confirmado!*\nOlá ${nome}! Seu horário para o dia ${data} às ${hora} está confirmado.\nNos vemos em breve! 💈`;
    
    case 'agendamento_cancelado':
      return `❌ *Agendamento Cancelado*\nOlá ${nome}, seu agendamento para o dia ${data} às ${hora} foi cancelado.\nSe desejar, você pode agendar um novo horário pelo nosso app! 📱`;
    
    case 'remarcacao_solicitada':
      return `Olá ${nome}!\nPrecisamos remarcar seu agendamento de ${data} às ${hora}.\nMotivo: ${payload.motivo || 'Imprevisto'}\nPor favor, acesse o app para escolher um novo horário.`;

    case 'remarcacao_concluida':
    case 'agendamento_remarcado':
      return `🔄 *Agendamento Remarcado!*\nOlá ${nome}! Seu ${servico} foi remarcado com sucesso para o dia ${data} às ${hora}.\nNos vemos em breve! 💈`;


    
    case 'lembrete_agendamento':
      return `Olá ${nome}! 📢\nLembrete: Seu agendamento é amanhã!\n📅 ${data} ⏰ ${hora} ✂️ ${servico}\nTe esperamos!`;
    
    case 'atendimento_finalizado':
      return `Olá ${nome}! 💈 Obrigado pela visita! Esperamos que tenha gostado do ${servico}.\nVolte sempre! ⭐`;
    
    default:
      return `Olá ${nome}! Temos uma atualização sobre seu agendamento. Acesse o app para mais detalhes.`;
  }
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

    // Buscar configuração do webhook (sempre a mais recente)
    const { data: config, error: configError } = await supabase
      .from('webhook_config')
      .select('webhook_url, ativo, confirmacao_webhook_url, confirmacao_ativo, lembrete_webhook_url, lembrete_ativo')
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (configError) {
      console.error('[send-webhook-event] Erro ao buscar config:', configError);
      return new Response(
        JSON.stringify({ success: false, error: 'Configuração de webhook não encontrada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const webhookUrl = resolveWebhookUrl(config, payload.evento);

    if (!webhookUrl) {
      console.log('[send-webhook-event] Webhook não configurado ou inativo');
      return new Response(
        JSON.stringify({ success: false, error: 'Webhook não configurado ou inativo' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Garantir timestamp e evento_id
    const eventPayload: WebhookEventPayload = {
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

    // SEMPRE garantir que cliente_telefone_whatsapp esteja formatado corretamente
    if (eventPayload.cliente_telefone && !eventPayload.cliente_telefone_whatsapp) {
      eventPayload.cliente_telefone_whatsapp = formatPhoneForWhatsApp(eventPayload.cliente_telefone);
    }
    
    // Se já veio um cliente_telefone_whatsapp mas não está no formato correto, reformatar
    if (eventPayload.cliente_telefone_whatsapp && !eventPayload.cliente_telefone_whatsapp.endsWith('@s.whatsapp.net')) {
      eventPayload.cliente_telefone_whatsapp = formatPhoneForWhatsApp(eventPayload.cliente_telefone_whatsapp);
    }

    // Se temos barbeiro_id mas falta nome, buscar
    if (eventPayload.barbeiro_id && (!eventPayload.barbeiro_nome || !extractTenantId(eventPayload.detalhes))) {
      try {
        const { data: barbeiro } = await supabase
          .from('barbeiros')
          .select('apelido, tenant_id')
          .eq('id', eventPayload.barbeiro_id)
          .single();
        
        if (barbeiro) {
          eventPayload.barbeiro_nome = barbeiro.apelido;
          // Incluir tenant_id nos detalhes
          if (!eventPayload.detalhes) eventPayload.detalhes = {};
          (eventPayload.detalhes as any).tenant_id = barbeiro.tenant_id;
        }
      } catch (e) {
        console.warn('[send-webhook-event] Não foi possível buscar dados do barbeiro:', e);
      }
    }

    // ====================================================
    // SEMPRE buscar instância WhatsApp do barbeiro
    // ====================================================
    let whatsappInstance: WhatsAppInstanceRecord | null = null;
    
    // Tentar buscar barbeiro_id do agendamento se não tiver
    let barbeiroIdToUse = eventPayload.barbeiro_id;
    if (!barbeiroIdToUse && eventPayload.agendamento_id) {
      try {
        const { data: apt } = await supabase
          .from('agendamentos')
          .select('barbeiro_id')
          .eq('id', eventPayload.agendamento_id)
          .single();
        if (apt?.barbeiro_id) {
          barbeiroIdToUse = apt.barbeiro_id;
          eventPayload.barbeiro_id = apt.barbeiro_id;
        }
      } catch (e) {
        console.warn('[send-webhook-event] Não foi possível buscar barbeiro_id do agendamento:', e);
      }
    }

    let tenantIdToUse = extractTenantId(eventPayload.detalhes);

    if (barbeiroIdToUse && !tenantIdToUse) {
      try {
        const { data: barberContext } = await supabase
          .from('barbeiros')
          .select('tenant_id, apelido')
          .eq('id', barbeiroIdToUse)
          .single();

        if (barberContext?.tenant_id) {
          tenantIdToUse = barberContext.tenant_id;
          if (!eventPayload.detalhes) eventPayload.detalhes = {};
          (eventPayload.detalhes as Record<string, unknown>).tenant_id = barberContext.tenant_id;
        }

        if (!eventPayload.barbeiro_nome && barberContext?.apelido) {
          eventPayload.barbeiro_nome = barberContext.apelido;
        }
      } catch (e) {
        console.warn('[send-webhook-event] Não foi possível resolver tenant do barbeiro:', e);
      }
    }

    if (tenantIdToUse) {
      try {
        const { data: tenantBarbers } = await supabase
          .from('barbeiros')
          .select('id, apelido')
          .eq('tenant_id', tenantIdToUse);

        const barberIds = tenantBarbers?.map((barber) => barber.id) || [];

        if (barberIds.length > 0) {
          const barberNames = new Map((tenantBarbers || []).map((barber) => [barber.id, barber.apelido]));

          const { data: tenantInstances } = await supabase
            .from('whatsapp_instances')
            .select('barbeiro_id, instance_name, api_key, status, connected_at, created_at')
            .in('barbeiro_id', barberIds)
            .eq('status', 'connected');

          const resolvedInstance = choosePrimaryTenantInstance(
            (tenantInstances || []).map((instance) => ({
              ...instance,
              barbeiro_nome: barberNames.get(instance.barbeiro_id) || null,
            })),
          );

          if (resolvedInstance) {
            whatsappInstance = resolvedInstance;
            console.log(
              '[send-webhook-event] Instância principal do tenant selecionada:',
              resolvedInstance.instance_name,
              '| barbeiro:',
              resolvedInstance.barbeiro_nome,
            );
          }
        }
      } catch (e) {
        console.warn('[send-webhook-event] Falha ao buscar instância principal do tenant:', e);
      }
    }

    if (!whatsappInstance && barbeiroIdToUse) {
      try {
        const { data: inst } = await supabase
          .from('whatsapp_instances')
          .select('barbeiro_id, instance_name, api_key, status, connected_at, created_at')
          .eq('barbeiro_id', barbeiroIdToUse)
          .eq('status', 'connected')
          .limit(1)
          .single();
        
        if (inst) {
          whatsappInstance = inst;
          console.log('[send-webhook-event] Fallback para instância do barbeiro:', inst.instance_name);
        }
      } catch (e) {
        console.warn('[send-webhook-event] Nenhuma instância WhatsApp encontrada para barbeiro:', barbeiroIdToUse);
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

    // GERAR MENSAGEM PERSONALIZADA SE NÃO TIVER
    if (!eventPayload.mensagem && eventPayload.evento !== 'disparo_mensagem') {
      eventPayload.mensagem = gerarMensagemPersonalizada(eventPayload.evento, eventPayload);
    }

    console.log('[send-webhook-event] Enviando para:', webhookUrl);
    console.log('[send-webhook-event] Telefone WhatsApp:', eventPayload.cliente_telefone_whatsapp);
    console.log('[send-webhook-event] WhatsApp Instance:', whatsappInstance?.instance_name || 'N/A');
    console.log('[send-webhook-event] Mensagem:', eventPayload.mensagem);

    // Montar payload final com instância WhatsApp
    const finalPayload: Record<string, unknown> = {
      ...eventPayload,
      whatsapp_instance: whatsappInstance ? {
        barbeiro_id: whatsappInstance.barbeiro_id,
        barbeiro_nome: whatsappInstance.barbeiro_nome || eventPayload.barbeiro_nome || null,
        instance_name: whatsappInstance.instance_name,
        api_key: whatsappInstance.api_key,
        status: whatsappInstance.status,
      } : null,
      contatos: [{
        cliente_id: eventPayload.cliente_id,
        cliente_nome: eventPayload.cliente_nome,
        cliente_telefone: eventPayload.cliente_telefone,
        cliente_telefone_whatsapp: eventPayload.cliente_telefone_whatsapp,
        mensagem: eventPayload.mensagem,
      }],
    };

    console.log('[send-webhook-event] Payload completo:', JSON.stringify(finalPayload, null, 2));

    // Enviar evento para o webhook
    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(finalPayload),
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
          cliente_telefone_whatsapp: eventPayload.cliente_telefone_whatsapp,
          status_code: webhookResponse.status,
          error: errorText,
          webhook_url: webhookUrl.substring(0, 50) + '...',
          whatsapp_instance_name: whatsappInstance?.instance_name || null,
          whatsapp_instance_barbeiro_id: whatsappInstance?.barbeiro_id || null,
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
        cliente_telefone: eventPayload.cliente_telefone,
        cliente_telefone_whatsapp: eventPayload.cliente_telefone_whatsapp,
        whatsapp_instance_name: whatsappInstance?.instance_name || null,
        whatsapp_instance_barbeiro_id: whatsappInstance?.barbeiro_id || null,
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
