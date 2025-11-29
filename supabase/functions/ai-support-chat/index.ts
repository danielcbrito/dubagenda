import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ========================================
// BASE DE CONHECIMENTO
// ========================================

const APP_KNOWLEDGE = `
# SISTEMA DUB - BASE DE CONHECIMENTO

## FUNCIONALIDADES
- Agendamentos: cliente agenda corte, escolhe barbeiro, data e horário
- Pontos: 1 corte = 1 ponto, 5 pontos = 1 corte grátis (resgate válido por 90 dias)
- Pagamentos: PIX, cartão ou dinheiro via Asaas Gateway
- Planos: assinatura mensal com créditos recorrentes
- Notificações: confirmações e lembretes

## PROBLEMAS COMUNS
- Pontos não creditaram → Barbeiro precisa confirmar o atendimento
- Não vejo horários → Verificar se há barbeiros ativos
- Pagamento pendente → Aguardar até 5min para webhook processar
- Resgate expirado → Válido apenas por 90 dias após geração
`;

// ========================================
// FUNÇÕES DISPONÍVEIS PARA A IA
// ========================================

const AVAILABLE_TOOLS = [
  {
    type: "function",
    function: {
      name: "verificar_dados_usuario",
      description: "Busca informações completas do usuário: agendamentos recentes, pontos acumulados, resgates disponíveis, créditos e status de assinatura. Use sempre que precisar diagnosticar problemas.",
      parameters: {
        type: "object",
        properties: {
          user_id: {
            type: "string",
            description: "ID do usuário no formato UUID"
          }
        },
        required: ["user_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "reenviar_email_confirmacao",
      description: "Reenvia email de confirmação para o usuário. Use quando o usuário não recebeu ou perdeu o email de verificação.",
      parameters: {
        type: "object",
        properties: {
          user_email: {
            type: "string",
            description: "Email do usuário"
          }
        },
        required: ["user_email"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "verificar_status_pagamento",
      description: "Verifica status de pagamentos pendentes ou recentes do usuário. Use para diagnosticar problemas de pagamento.",
      parameters: {
        type: "object",
        properties: {
          user_id: {
            type: "string",
            description: "ID do usuário"
          }
        },
        required: ["user_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "atualizar_perfil_basico",
      description: "Atualiza dados básicos do perfil do usuário (nome, telefone). Use apenas após confirmação explícita do usuário.",
      parameters: {
        type: "object",
        properties: {
          user_id: {
            type: "string",
            description: "ID do usuário"
          },
          nome: {
            type: "string",
            description: "Nome completo do usuário"
          },
          telefone: {
            type: "string",
            description: "Telefone no formato (XX) XXXXX-XXXX"
          }
        },
        required: ["user_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "criar_ticket_automatico",
      description: "Cria um ticket de suporte quando não conseguir resolver o problema automaticamente. Inclui todas as informações coletadas.",
      parameters: {
        type: "object",
        properties: {
          user_id: {
            type: "string",
            description: "ID do usuário (opcional para guests)"
          },
          titulo: {
            type: "string",
            description: "Título curto do problema"
          },
          descricao: {
            type: "string",
            description: "Descrição detalhada com passos já tentados"
          },
          prioridade: {
            type: "string",
            enum: ["low", "medium", "high", "critical"],
            description: "Prioridade baseada no impacto"
          },
          categoria: {
            type: "string",
            enum: ["bug", "payment", "auth", "booking", "other"],
            description: "Categoria do problema"
          },
          conversation_id: {
            type: "string",
            description: "ID da conversa atual"
          }
        },
        required: ["titulo", "descricao", "prioridade", "categoria", "conversation_id"]
      }
    }
  }
];

// ========================================
// UTILITÁRIOS DE RETRY E FALLBACK
// ========================================

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function logAIAction(supabase: any, data: any) {
  await supabase.from('ai_actions_log').insert(data);
}

async function createPendingTicket(supabase: any, data: any) {
  const pendingTicketId = `PT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const { error } = await supabase.from('pending_tickets').insert({
    pending_ticket_id: pendingTicketId,
    ...data
  });

  if (error) {
    console.error('❌ Erro ao criar pending_ticket:', error);
    // Fallback: enviar email ou webhook de emergência aqui
    return { sucesso: false, erro: error.message };
  }

  console.log('✅ Pending ticket criado:', pendingTicketId);
  return { sucesso: true, pending_ticket_id: pendingTicketId };
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`⏳ Retry ${attempt + 1}/${maxRetries} após ${delay}ms...`);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}

// ========================================
// VERIFICAÇÕES PROATIVAS (HEALTH CHECKS)
// ========================================

async function runProactiveDiagnostics(supabase: any, user_id: string, message: string) {
  console.log('🔍 Executando diagnósticos proativos...');
  
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    checks_performed: []
  };

  // 1. Verificar dados do usuário
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('nome, telefone, blocked')
      .eq('id', user_id)
      .single();
    
    diagnostics.user_status = profile?.blocked ? 'blocked' : 'active';
    diagnostics.checks_performed.push('user_status');
  } catch (e) {
    diagnostics.user_status = 'error';
  }

  // 2. Verificar agendamentos recentes com erros
  try {
    const { data: appointments } = await supabase
      .from('agendamentos')
      .select('id, data, hora, status, created_at')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(5);
    
    const failedAppointments = appointments?.filter((a: any) => 
      a.status?.includes('cancelled') || a.status === 'failed'
    );
    
    diagnostics.recent_failed_appointments = failedAppointments?.length || 0;
    diagnostics.checks_performed.push('appointments');
  } catch (e) {
    diagnostics.recent_failed_appointments = 'error';
  }

  // 3. Verificar pagamentos pendentes
  try {
    const { data: payments } = await supabase
      .from('pagamentos')
      .select('id, status, valor, created_at')
      .eq('user_id', user_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(3);
    
    diagnostics.pending_payments = payments?.length || 0;
    diagnostics.checks_performed.push('payments');
  } catch (e) {
    diagnostics.pending_payments = 'error';
  }

  // 4. Verificar logs recentes do sistema relacionados ao usuário
  try {
    const { data: logs } = await supabase
      .from('system_logs')
      .select('level, message, created_at')
      .eq('user_id', user_id)
      .in('level', ['error', 'warn'])
      .order('created_at', { ascending: false })
      .limit(5);
    
    diagnostics.recent_errors = logs?.length || 0;
    diagnostics.error_messages = logs?.map((l: any) => l.message).slice(0, 3);
    diagnostics.checks_performed.push('system_logs');
  } catch (e) {
    diagnostics.recent_errors = 'error';
  }

  // 5. Inferir problema baseado na mensagem
  const messageLower = message.toLowerCase();
  if (messageLower.includes('erro 202') || messageLower.includes('202')) {
    diagnostics.inferred_issue = 'payment_processing_error';
    diagnostics.suggested_action = 'verify_payment_status';
  } else if (messageLower.includes('não consigo') && messageLower.includes('agendar')) {
    diagnostics.inferred_issue = 'booking_creation_error';
    diagnostics.suggested_action = 'check_availability_and_slots';
  } else if (messageLower.includes('ponto') || messageLower.includes('pontos')) {
    diagnostics.inferred_issue = 'loyalty_points_issue';
    diagnostics.suggested_action = 'verify_points_and_confirmations';
  } else if (messageLower.includes('email') || messageLower.includes('confirmação')) {
    diagnostics.inferred_issue = 'email_verification_issue';
    diagnostics.suggested_action = 'resend_confirmation_email';
  }

  console.log('✅ Diagnósticos completos:', diagnostics);
  return diagnostics;
}

// ========================================
// IMPLEMENTAÇÃO DAS FUNÇÕES
// ========================================

async function executeFunction(functionName: string, args: any, supabase: any, conversationId: string) {
  console.log(`🔧 Executando função: ${functionName}`, args);
  
  const actionLog: any = {
    conversation_id: conversationId,
    user_id: args.user_id,
    action_type: 'function_call',
    action_name: functionName,
    parameters: args,
    success: false,
    created_at: new Date().toISOString()
  };

  try {
    let result: any;
    
    switch (functionName) {
      case "verificar_dados_usuario": {
        const { user_id } = args;
        
        // Buscar perfil
        const { data: profile } = await supabase
          .from('profiles')
          .select('nome, telefone, blocked')
          .eq('id', user_id)
          .single();

        // Buscar agendamentos recentes
        const { data: appointments } = await supabase
          .from('agendamentos')
          .select('id, data, hora, status, barbeiro_confirmou, ponto_liberado')
          .eq('user_id', user_id)
          .order('data', { ascending: false })
          .limit(5);

        // Buscar pontos
        const { data: points } = await supabase
          .from('pontos')
          .select('pontos, last_awarded_at')
          .eq('user_id', user_id)
          .single();

        // Buscar resgates disponíveis
        const { data: redemptions } = await supabase
          .from('resgates')
          .select('id, status, created_at, expired_at')
          .eq('user_id', user_id)
          .eq('status', 'available');

        // Buscar créditos disponíveis
        const { data: credits } = await supabase
          .from('creditos')
          .select('valor, origem, usado, expires_at')
          .eq('user_id', user_id)
          .eq('usado', false);

        // Buscar assinatura
        const { data: subscription } = await supabase
          .from('assinaturas')
          .select('status, next_billing_date')
          .eq('user_id', user_id)
          .single();

        const result = {
          perfil: profile,
          agendamentos_recentes: appointments,
          pontos: points?.pontos || 0,
          resgates_disponiveis: redemptions?.length || 0,
          creditos_disponiveis: credits?.reduce((sum: number, c: any) => sum + Number(c.valor), 0) || 0,
          assinatura: subscription
        };

        console.log('✅ Dados do usuário:', result);
        return JSON.stringify(result);
      }

      case "reenviar_email_confirmacao": {
        const { user_email } = args;
        
        // Chamar edge function de confirmação de email
        const { data, error } = await supabase.functions.invoke('send-confirmation-email', {
          body: { email: user_email }
        });

        if (error) {
          console.error('❌ Erro ao reenviar email:', error);
          return JSON.stringify({ sucesso: false, erro: error.message });
        }

        console.log('✅ Email reenviado');
        return JSON.stringify({ sucesso: true, mensagem: 'Email de confirmação reenviado com sucesso' });
      }

      case "verificar_status_pagamento": {
        const { user_id } = args;
        
        const { data: payments } = await supabase
          .from('pagamentos')
          .select('id, valor, status, metodo, created_at, data_pagamento')
          .eq('user_id', user_id)
          .order('created_at', { ascending: false })
          .limit(5);

        console.log('✅ Pagamentos verificados:', payments);
        return JSON.stringify(payments || []);
      }

      case "atualizar_perfil_basico": {
        const { user_id, nome, telefone } = args;
        
        const updates: any = {};
        if (nome) updates.nome = nome;
        if (telefone) updates.telefone = telefone;

        const { data, error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', user_id)
          .select();

        if (error) {
          console.error('❌ Erro ao atualizar perfil:', error);
          return JSON.stringify({ sucesso: false, erro: error.message });
        }

        console.log('✅ Perfil atualizado:', data);
        return JSON.stringify({ sucesso: true, dados_atualizados: updates });
      }

      case "criar_ticket_automatico": {
        const { user_id, titulo, descricao, prioridade, categoria, conversation_id } = args;
        
        // Buscar dados do usuário para o ticket
        let userName = '';
        let userPhone = '';
        let userEmail = '';
        
        if (user_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('nome, telefone')
            .eq('id', user_id)
            .single();
          
          userName = profile?.nome || '';
          userPhone = profile?.telefone || '';
          
          // Buscar email do auth.users
          const { data: { user: authUser } } = await supabase.auth.admin.getUserById(user_id);
          userEmail = authUser?.email || '';
        }

        // Tentar criar ticket com retry e backoff
        try {
          result = await retryWithBackoff(async () => {
            const { data: ticket, error } = await supabase
              .from('support_tickets')
              .insert({
                user_id: user_id || null,
                conversation_id,
                title: titulo,
                description: descricao,
                priority: prioridade,
                category: categoria,
                status: 'open',
                metadata: {
                  created_by_ai: true,
                  timestamp: new Date().toISOString(),
                  diagnostics: args.diagnostics || {}
                }
              })
              .select()
              .single();

            if (error) throw error;
            
            console.log('✅ Ticket criado com sucesso:', ticket.id);
            actionLog.success = true;
            actionLog.result = { ticket_id: ticket.id };
            await logAIAction(supabase, actionLog);
            
            return { 
              sucesso: true, 
              ticket_id: ticket.id,
              mensagem: `Ticket #${ticket.id.substring(0, 8)} criado — nossa equipe entrará em contato`
            };
          }, 3, 2000);
          
          return JSON.stringify(result);
          
        } catch (error: any) {
          console.error('❌ Falha ao criar ticket após retries:', error);
          
          // FALLBACK: criar pending_ticket
          const pendingResult = await createPendingTicket(supabase, {
            session_id: args.session_id,
            conversation_id,
            user_id: user_id || null,
            user_name: userName,
            user_phone: userPhone,
            user_email: userEmail,
            summary: titulo,
            description: descricao,
            priority: prioridade,
            category: categoria,
            retry_count: 3,
            status: 'pending',
            last_error: error.message,
            payload: args
          });
          
          actionLog.success = false;
          actionLog.error_message = error.message;
          actionLog.result = pendingResult;
          await logAIAction(supabase, actionLog);
          
          if (pendingResult.sucesso) {
            return JSON.stringify({
              sucesso: true,
              pending: true,
              pending_ticket_id: pendingResult.pending_ticket_id,
              mensagem: `Não consegui criar o ticket automaticamente. Registrei seu caso (ID: ${pendingResult.pending_ticket_id}) e nosso suporte já foi notificado — alguém entrará em contato em breve`
            });
          } else {
            // Último recurso: retornar erro mas garantir que chegue ao usuário
            return JSON.stringify({
              sucesso: false,
              erro: 'ticket_creation_failed',
              mensagem: 'Houve um problema ao registrar seu caso. Por favor, entre em contato diretamente pelo telefone (XX) XXXX-XXXX ou aguarde — nossa equipe já foi notificada'
            });
          }
        }
      }

      default:
        result = { erro: 'Função não encontrada' };
    }
    
    // Log de sucesso
    actionLog.success = true;
    actionLog.result = result;
    await logAIAction(supabase, actionLog);
    
    return JSON.stringify(result);
    
  } catch (error: any) {
    console.error(`❌ Erro ao executar ${functionName}:`, error);
    
    // Log de erro
    actionLog.success = false;
    actionLog.error_message = error.message;
    await logAIAction(supabase, actionLog);
    
    return JSON.stringify({ sucesso: false, erro: error.message });
  }
}

// ========================================
// SERVIDOR PRINCIPAL
// ========================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationId, action, guestName, guestEmail } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Autenticação
    const authHeader = req.headers.get('Authorization');
    let user = null;
    let isGuest = false;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user: authUser } } = await supabase.auth.getUser(token);
      if (authUser) user = authUser;
    }
    
    if (!user) {
      isGuest = true;
      user = { id: `guest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, email: guestEmail };
    }

    console.log('📩 Nova mensagem:', { userId: user.id, isGuest });

    // Buscar ou criar conversa
    let conversation;
    if (conversationId) {
      const { data } = await supabase
        .from('support_conversations')
        .select('*')
        .eq('id', conversationId)
        .single();
      conversation = data;
    }

    if (!conversation) {
      const { data: newConv } = await supabase
        .from('support_conversations')
        .insert({ 
          user_id: isGuest ? null : user.id,
          metadata: isGuest ? { guest_name: guestName, guest_email: guestEmail, is_guest: true } : {}
        })
        .select()
        .single();
      conversation = newConv;
      console.log('💬 Nova conversa:', conversation.id);
    }

    // Salvar mensagem do usuário
    await supabase.from('support_messages').insert({
      conversation_id: conversation.id,
      role: 'user',
      content: message
    });

    // Buscar histórico
    const { data: messages } = await supabase
      .from('support_messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .limit(20);

    const conversationHistory = messages?.map(msg => ({
      role: msg.role,
      content: msg.content
    })) || [];

    // ========================================
    // DIAGNÓSTICOS PROATIVOS (INFERÊNCIA)
    // ========================================
    
    let diagnostics: any = null;
    if (!isGuest && message.length < 100) {
      // Mensagem curta de usuário logado = provável problema
      diagnostics = await runProactiveDiagnostics(supabase, user.id, message);
    }

    // ========================================
    // CHAMADA INICIAL DA IA COM TOOLS
    // ========================================

    console.log('🤖 Chamando IA com function calling...');
    
    const systemContent = `# ASSISTENTE TÉCNICA INTELIGENTE - DUB

Você é uma IA avançada de suporte técnico com capacidade de diagnosticar e resolver problemas automaticamente.

## COMPORTAMENTO OBRIGATÓRIO

**SEMPRE:**
- Mensagens CURTAS (máximo 3 frases)
- Tom educado, profissional e confiante
- Informar TODAS as ações executadas: "Acabei de verificar seus dados..."
- Usar as ferramentas disponíveis para diagnosticar e resolver
- Tentar resolver ANTES de escalar para humano

**FORMATO DE RESPOSTA:**
1. Ação: "Vou verificar X agora"
2. Resultado: "Encontrei Y" ou "Corrigi Z"
3. Próximo passo: instrução clara ou "Pronto!"

**INFERÊNCIA PROATIVA:**
${diagnostics ? `
DIAGNÓSTICOS JÁ EXECUTADOS AUTOMATICAMENTE:
- Status do usuário: ${diagnostics.user_status}
- Agendamentos com erro recentes: ${diagnostics.recent_failed_appointments}
- Pagamentos pendentes: ${diagnostics.pending_payments}
- Erros recentes no sistema: ${diagnostics.recent_errors}
${diagnostics.inferred_issue ? `- Problema inferido: ${diagnostics.inferred_issue}` : ''}
${diagnostics.suggested_action ? `- Ação sugerida: ${diagnostics.suggested_action}` : ''}
${diagnostics.error_messages?.length ? `- Mensagens de erro: ${diagnostics.error_messages.join('; ')}` : ''}

Use essas informações para resolver o problema RAPIDAMENTE sem pedir dados que já foram verificados.
` : ''}

**FERRAMENTAS DISPONÍVEIS:**
Use as funções para:
- verificar_dados_usuario: checar agendamentos, pontos, créditos
- reenviar_email_confirmacao: reenviar email de verificação
- verificar_status_pagamento: checar pagamentos pendentes
- atualizar_perfil_basico: atualizar nome/telefone (APENAS com permissão)
- criar_ticket_automatico: abrir ticket se não conseguir resolver

**QUANDO ABRIR TICKET:**
- Após 3 tentativas sem sucesso
- Problema financeiro crítico
- Bug técnico complexo
- Usuário pede atendimento humano

**IMPORTANTE:**
- ID do usuário atual: ${!isGuest ? user.id : 'usuário convidado'}
- Email do usuário: ${user.email || 'não fornecido'}
- ID da conversa: ${conversation.id}

${APP_KNOWLEDGE}

Seja direta, eficiente e resolva o máximo possível sozinha.`;
    
    const initialPayload = {
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: systemContent
        },
        ...conversationHistory
      ],
      tools: AVAILABLE_TOOLS,
      temperature: 0.7,
      max_tokens: 1000
    };

    let aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(initialPayload)
    });

    if (!aiResponse.ok) {
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    let aiData = await aiResponse.json();
    let choice = aiData.choices[0];
    let iterations = 0;
    const maxIterations = 5;

    // ========================================
    // LOOP DE FUNCTION CALLING
    // ========================================

    while (choice.finish_reason === 'tool_calls' && iterations < maxIterations) {
      iterations++;
      console.log(`🔄 Iteração ${iterations} - Executando function calls...`);

      const toolCalls = choice.message.tool_calls;
      const toolResults = [];

      // Executar todas as funções chamadas
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);
        
        console.log(`⚙️ Chamando: ${functionName}`, functionArgs);
        
        const result = await executeFunction(functionName, functionArgs, supabase, conversation.id);
        
        toolResults.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          name: functionName,
          content: result
        });
      }

      // Continuar conversa com resultados das funções
      const followUpPayload = {
        model: 'google/gemini-2.5-flash',
        messages: [
          ...initialPayload.messages,
          choice.message,
          ...toolResults
        ],
        tools: AVAILABLE_TOOLS,
        temperature: 0.7,
        max_tokens: 1000
      };

      aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(followUpPayload)
      });

      if (!aiResponse.ok) {
        throw new Error(`AI error: ${aiResponse.status}`);
      }

      aiData = await aiResponse.json();
      choice = aiData.choices[0];
    }

    // Resposta final da IA
    const assistantMessage = choice.message.content;
    console.log('✅ Resposta final da IA:', assistantMessage.substring(0, 100));

    // Salvar resposta
    await supabase.from('support_messages').insert({
      conversation_id: conversation.id,
      role: 'assistant',
      content: assistantMessage
    });

    return new Response(JSON.stringify({
      conversationId: conversation.id,
      response: assistantMessage
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro no chat:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      response: 'Desculpe, ocorreu um erro. Tente novamente.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
