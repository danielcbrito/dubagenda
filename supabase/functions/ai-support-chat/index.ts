import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Conhecimento completo do aplicativo da barbearia
const APP_KNOWLEDGE = `
# SISTEMA DE BARBEARIA DUB

## FUNCIONALIDADES PRINCIPAIS

### Para Clientes:
1. **Agendamento de Cortes**
   - Escolher serviço (Corte, Barba, Combo)
   - Selecionar data e horário disponível
   - Escolher barbeiro (opcional)
   - Confirmar agendamento
   - Receber notificações

2. **Sistema de Pontos e Fidelidade**
   - Ganhar 1 ponto a cada corte completado
   - Acumular 5 pontos = 1 corte grátis
   - Resgatar cortes grátis na página de agendamento
   - Validade de 90 dias para resgates

3. **Pagamentos**
   - Pagar no local (dinheiro/cartão)
   - Sistema de créditos
   - Histórico de pagamentos

4. **Perfil do Cliente**
   - Visualizar dados pessoais
   - Ver histórico de agendamentos
   - Acompanhar pontos acumulados
   - Visualizar cortes grátis disponíveis

### Para Admin:
1. **Gestão de Agendamentos**
   - Ver agenda diária/mensal
   - Confirmar atendimentos
   - Remarcar agendamentos
   - Cancelar agendamentos

2. **Gestão de Clientes**
   - Visualizar todos os clientes
   - Ver histórico de cada cliente
   - Gerenciar perfis

3. **Gestão Financeira**
   - Visualizar receitas
   - Ver pagamentos pendentes
   - Relatórios financeiros

4. **Gestão de Serviços**
   - Adicionar/editar serviços
   - Definir preços e durações

5. **Sistema de Pontos e Promoções**
   - Gerenciar promoções
   - Ver sistema de fidelidade
   - Configurar regras de pontos

## ESTRUTURA DE NAVEGAÇÃO

### Cliente:
- /cliente - Dashboard principal
- /cliente/agendar - Página de agendamento
- /cliente/assinar - Página de planos (em desenvolvimento)

### Admin:
- /admin/dashboard - Visão geral
- /admin/agenda - Gestão de agendamentos
- /admin/clientes - Gestão de clientes
- /admin/servicos - Gestão de serviços
- /admin/financeiro - Gestão financeira
- /admin/relatorios - Relatórios
- /admin/confirmacoes-pendentes - Confirmações pendentes

## PROBLEMAS COMUNS E SOLUÇÕES

1. **"Não consigo agendar"**
   - Verificar se está logado
   - Verificar se selecionou serviço, data e horário
   - Verificar se o horário está disponível

2. **"Meus pontos não aparecem"**
   - Pontos são liberados após o barbeiro confirmar o atendimento
   - Ir em: Menu > Meu Perfil > Ver pontos de fidelidade

3. **"Como usar meu corte grátis?"**
   - Na página de agendamento, marcar a opção "Usar corte grátis"
   - Só aparece se tiver corte grátis disponível

4. **"Não recebi notificação"**
   - Verificar se está logado
   - Notificações aparecem no ícone de sino no topo

5. **"Como cancelo um agendamento?"**
   - Ir na página principal
   - Encontrar o agendamento
   - Clicar em "Cancelar Agendamento"

## TECNOLOGIA
- Frontend: React + TypeScript + Tailwind CSS
- Backend: Supabase (PostgreSQL + Edge Functions)
- Autenticação: Supabase Auth
- Pagamentos: Asaas (gateway brasileiro)
`;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationId, action, guestName, guestEmail } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Verificar autenticação (OPCIONAL - permite usuários anônimos)
    const authHeader = req.headers.get('Authorization');
    let user = null;
    let isGuest = false;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user: authUser }, error: userError } = await supabase.auth.getUser(token);
      if (!userError && authUser) {
        user = authUser;
      }
    }
    
    // Se não tem usuário autenticado, é guest
    if (!user) {
      isGuest = true;
      user = { id: `guest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` };
    }

    console.log('📩 Nova mensagem recebida:', { 
      userId: user.id, 
      isGuest, 
      action, 
      message: message?.substring(0, 50) 
    });

    // Ações especiais
    if (action === 'create_ticket') {
      // Para guests, salvar nome e email no metadata
      const ticketMetadata = isGuest ? {
        guest_name: guestName || 'Anônimo',
        guest_email: guestEmail || 'não fornecido',
        is_guest: true
      } : { is_guest: false };

      const { data: ticket, error: ticketError } = await supabase
        .from('support_tickets')
        .insert({
          conversation_id: conversationId,
          user_id: isGuest ? null : user.id,
          title: message.substring(0, 100),
          description: message,
          status: 'open',
          priority: 'medium',
          category: 'bug',
          metadata: ticketMetadata
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      console.log('🎫 Ticket criado:', ticket.id, { isGuest, metadata: ticketMetadata });

      return new Response(JSON.stringify({
        response: `Chamado #${ticket.id.substring(0, 8)} criado com sucesso. Nossa equipe responderá em breve${guestEmail ? ` no email ${guestEmail}` : ''}.`,
        ticketId: ticket.id,
        conversationId: conversationId
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

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
      const conversationMetadata = isGuest ? {
        guest_name: guestName || 'Visitante',
        guest_email: guestEmail || '',
        is_guest: true
      } : { is_guest: false };

      const { data: newConv, error: convError } = await supabase
        .from('support_conversations')
        .insert({ 
          user_id: isGuest ? null : user.id,
          metadata: conversationMetadata
        })
        .select()
        .single();

      if (convError) {
        console.error('Erro ao criar conversa:', convError);
        throw convError;
      }
      conversation = newConv;
      console.log('💬 Nova conversa criada:', conversation.id, { isGuest });
    }

    // Salvar mensagem do usuário
    await supabase.from('support_messages').insert({
      conversation_id: conversation.id,
      role: 'user',
      content: message
    });

    // Buscar histórico da conversa
    const { data: messages } = await supabase
      .from('support_messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .limit(20);

    // Montar contexto para a IA
    const conversationHistory = messages?.map(msg => ({
      role: msg.role,
      content: msg.content
    })) || [];

    // Chamar Lovable AI (Google Gemini)
    console.log('🤖 Chamando Lovable AI...');
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Você é um assistente de suporte inteligente e profissional para o sistema de barbearia DUB.

ESTILO DE RESPOSTA:
- Seja educado, claro e objetivo
- Use linguagem profissional mas acessível
- Sem emojis ou símbolos decorativos
- Respostas concisas e diretas ao ponto
- Mantenha tom neutro e prestativo

CAPACIDADES:
1. Responder dúvidas sobre o sistema
2. Guiar usuários em funcionalidades
3. Coletar informações para abertura de tickets
4. Diagnosticar problemas técnicos

FLUXO DE TICKETS:
Quando usuário reportar problema complexo ou após 2-3 tentativas sem resolver:
1. Pergunte: "Em qual tela você está?"
2. Pergunte: "Qual mensagem de erro aparece?"
3. Pergunte: "O que você esperava que acontecesse?"
4. Após coletar, diga: "Vou abrir um chamado para nossa equipe técnica. Para isso, preciso de seu nome e email."
5. Quando receber, confirme: "Perfeito. Digite 'criar ticket' para finalizar."

IMPORTANTE:
- NUNCA invente funcionalidades
- Use apenas informações da base de conhecimento abaixo
- Se não souber, seja honesto e ofereça criar ticket

BASE DE CONHECIMENTO:
${APP_KNOWLEDGE}
`
          },
          ...conversationHistory
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('❌ Erro da AI:', aiResponse.status, errorText);
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const assistantMessage = aiData.choices[0].message.content;

    console.log('✅ Resposta da IA:', assistantMessage.substring(0, 100));

    // Salvar resposta da IA
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
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ 
      error: errorMessage,
      conversationId: null,
      response: 'Desculpe, ocorreu um erro. Por favor, tente novamente.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});