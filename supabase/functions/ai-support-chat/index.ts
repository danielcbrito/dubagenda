import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ========================================
// SISTEMA DE CONHECIMENTO E DIAGNÓSTICO AVANÇADO
// ========================================

const SYSTEM_DIAGNOSTICS = {
  checks: {
    auth: 'Status de autenticação',
    appointments: 'Agendamentos recentes',
    payments: 'Pagamentos pendentes',
    points: 'Saldo de pontos',
    credits: 'Créditos disponíveis',
    subscription: 'Status da assinatura',
  },
  actions: {
    clearCache: 'Limpar cache da sessão',
    resendEmail: 'Reenviar email de confirmação',
    refreshToken: 'Renovar token de acesso',
    syncData: 'Sincronizar dados',
  }
};

const APP_KNOWLEDGE = `
# SISTEMA DUB - BASE DE CONHECIMENTO TÉCNICA

## ARQUITETURA
- Frontend: React 18 + Vite + TypeScript + Tailwind CSS
- Backend: Supabase (PostgreSQL + Edge Functions + Realtime)
- Auth: Supabase Auth (email/senha + Google OAuth)
- Pagamentos: Asaas API Gateway
- Storage: Supabase Storage

## FUNCIONALIDADES PRINCIPAIS

### 1. AGENDAMENTO (/cliente/agendar)
**Fluxo Completo:**
1. Login obrigatório
2. Escolher serviço
3. Selecionar data e horário disponível
4. Escolher barbeiro (opcional)
5. Adicionar observações (opcional)
6. Confirmar agendamento
7. Receber notificação

**Validações Técnicas:**
- Usuário autenticado: required
- Horário disponível: check em tempo real
- Conflitos: validação de sobreposição
- Serviço ativo: status=true

**Problemas Comuns:**
- "Não vejo horários" → Verificar barbeiros ativos e horários configurados
- "Erro ao confirmar" → Verificar créditos ou método de pagamento
- "Agendamento sumiu" → Verificar status (cancelled, completed)

### 2. PONTOS E FIDELIDADE
**Mecânica:**
- 1 corte confirmado = 1 ponto
- 5 pontos acumulados = 1 resgate (corte grátis)
- Pontos liberados após barbeiro confirmar
- Resgates expiram em 90 dias

**Condições para Liberar Ponto:**
- status = 'completed'
- barbeiro_confirmou = true
- is_free = false
- ponto_liberado = false

**Verificações:**
- Tabela: pontos (user_id, pontos, last_awarded_at)
- Tabela: resgates (status: available/used/expired)

**Problemas Comuns:**
- "Ponto não creditou" → Barbeiro não confirmou ainda
- "Não vejo resgate" → Precisa 5 pontos
- "Resgate expirado" → 90 dias de validade

### 3. PLANOS E ASSINATURAS
**Tipos:**
- Sem Plano: pagamento por corte
- Plano Mensal: créditos recorrentes

**Gestão:**
- Assinar: /cliente/assinar
- Ver plano: Menu → "Meus Planos"
- Cancelar: via admin

**Estados:**
- active: ativo
- cancelled: cancelado
- past_due: atraso no pagamento
- suspended: suspenso

**Problemas Comuns:**
- "Como assinar?" → Página /cliente/assinar
- "Pagamento não processou" → Verificar webhook Asaas
- "Plano não aparece" → Verificar tabela assinaturas

### 4. PAGAMENTOS (Asaas Gateway)
**Métodos:**
- PIX: código gerado automaticamente
- Cartão: processamento via Asaas
- Dinheiro: registro presencial

**Estados (payment_status):**
- pending: aguardando
- paid: confirmado
- failed: falhou
- overdue: atrasado
- refunded: reembolsado

**Webhooks:** Asaas notifica sistema via /asaas-webhook

**Problemas Comuns:**
- "PIX não gerou" → Verificar integração Asaas
- "Cartão rejeitado" → Validar dados
- "Pagamento pendente" → Aguardar webhook (até 5 min)

### 5. NOTIFICAÇÕES
**Tipos:**
- Confirmação de agendamento
- Lembrete 24h antes
- Confirmação de pagamento
- Promoções e avisos

**Visualização:**
- Ícone sino no header
- Badge com contador de não lidas

**Problemas Comuns:**
- "Não recebi notificação" → Verificar email + spam
- "Notificações não somem" → Clicar para marcar como lida

## NAVEGAÇÃO DO SISTEMA

### Cliente (/cliente)
- Dashboard: visão geral + próximos agendamentos
- Agendar: /cliente/agendar
- Histórico: expandir seção "Histórico"
- Carteira: pontos + créditos + resgates
- Perfil: dados pessoais

### Admin (/admin)
- Dashboard: estatísticas gerais
- Agenda: gestão completa
- Clientes: todos os usuários
- Serviços: CRUD de serviços
- Financeiro: receitas + despesas
- Confirmações: aprovar atendimentos
- Promoções: gestão de campanhas
- Configurações: ajustes do sistema

## DIAGNÓSTICOS TÉCNICOS

### AUTENTICAÇÃO
**Sintomas:** "Sessão expirada", "Não consigo logar"
**Diagnóstico:**
1. Token válido? (verificar expiry)
2. Email confirmado? (check email_confirmed)
3. Conta bloqueada? (profiles.blocked)

**Soluções:**
- Logout + login
- Reenviar confirmação
- Desbloquear conta (admin)

### PERFORMANCE
**Sintomas:** "Lento", "Trava ao carregar"
**Diagnóstico:**
1. Conexão estável?
2. Cache corrompido?
3. Query pesada?

**Soluções:**
- Limpar cache (Ctrl+Shift+Del)
- Testar aba anônima
- Verificar network tab (F12)

### DADOS DESATUALIZADOS
**Sintomas:** "Info antiga", "Mudança não aparece"
**Soluções:**
- Recarregar (F5)
- Limpar cache
- Verificar sincronização

### ERROS DE BANCO
**Sintomas:** "Erro ao salvar", "Falha ao criar"
**Diagnóstico:**
1. RLS policies (permissões)
2. Constraints (validações)
3. Foreign keys (relações)
4. Campos obrigatórios

## TABELAS PRINCIPAIS

### agendamentos
- PK: id (uuid)
- FK: user_id, servico_id, barbeiro_id
- Status: pending, confirmed, completed, cancelled_by_user, cancelled_by_admin
- Flags: barbeiro_confirmou, cliente_confirmou, ponto_liberado

### pontos
- user_id, pontos (int), promocao_id
- Trigger: award_loyalty_point()

### resgates
- Status: available, used, expired
- Expiração: 90 dias

### profiles
- Dados: nome, telefone, cpf, blocked
- Relação: 1:1 com auth.users

## PROBLEMAS FREQUENTES (FAQ)

**"Como agendar?"**
1. Fazer login
2. Clicar em "Agendar"
3. Escolher serviço, data, horário
4. Confirmar

**"Cadê meus pontos?"**
- Menu → Carteira
- Pontos só liberam após confirmação do barbeiro

**"Como usar corte grátis?"**
- Ao agendar, marcar opção "Usar resgate"
- Só aparece se tiver resgate disponível

**"Como cancelo?"**
- Dashboard → encontrar agendamento
- Clicar "Cancelar"
- Confirmar cancelamento

**"Esqueci minha senha"**
- Tela de login → "Esqueci senha"
- Receber email com link
- Criar nova senha

## QUANDO ABRIR TICKET

**Situações Obrigatórias:**
1. Erro não resolvido após 3 tentativas
2. Problema financeiro/pagamento crítico
3. Bug técnico reproduzível
4. Alteração de dados sensíveis
5. Problema de segurança
6. Usuário pede atendimento humano

**Prioridades:**
- CRÍTICA: sistema fora, dados perdidos, falha de segurança
- ALTA: pagamento bloqueado, funcionalidade core quebrada
- MÉDIA: bug não crítico, dúvida complexa
- BAIXA: dúvida simples, sugestão de melhoria

**Informações a Coletar:**
- Local exato do erro (URL/página)
- Mensagem de erro (screenshot se possível)
- Passos para reproduzir
- Horário do ocorrido
- Dispositivo/navegador
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
            content: `# ASSISTENTE TÉCNICA AVANÇADA - DUB

Você é uma assistente de suporte técnico especializada, altamente competente e orientada a resultados.

## COMPORTAMENTO OBRIGATÓRIO

**TONALIDADE:** Profissional, direta, confiante, acolhedora

**FORMATO DE MENSAGEM (1-3 frases por resposta):**
1. Ação proposta: "Vou verificar X agora"
2. Resultado/diagnóstico: "Encontrado erro Y"  
3. Próximo passo: "Vou fazer Z" ou "Preciso que você faça W"

**REGRAS DE OURO:**
✅ Mensagens CURTAS e OBJETIVAS (máx 3 frases)
✅ Confirmar antes de ações de risco
✅ Diagnosticar com base em dados reais
✅ Se não resolver em 3 tentativas → ticket
✅ Proteger dados sensíveis

❌ NUNCA jargão técnico sem explicação
❌ NUNCA mensagens longas e confusas
❌ NUNCA emojis ou símbolos decorativos
❌ NUNCA inventar funcionalidades

## DIAGNÓSTICO AUTOMÁTICO

**Checks Disponíveis:**
${JSON.stringify(SYSTEM_DIAGNOSTICS.checks, null, 2)}

**Ações Corretivas:**
${JSON.stringify(SYSTEM_DIAGNOSTICS.actions, null, 2)}

**Fluxo de Diagnóstico:**
1. Identificar categoria (auth/pagamento/agendamento/técnico)
2. Perguntar detalhes específicos e diretos
3. Propor solução concreta OU escalar para ticket

## ESCALONAMENTO PARA TICKET

**Quando Criar Ticket:**
- Erro persistente após 3 tentativas
- Problema financeiro crítico
- Bug técnico reproduzível
- Alteração de dados sensíveis
- Problema de segurança
- Usuário solicita atendimento humano

**Informações a Coletar:**
1. "Em qual tela você está?"
2. "Qual mensagem de erro aparece exatamente?"
3. "O que você tentou fazer?"
4. "Quando aconteceu?"

**Após coletar:** "Vou abrir ticket com diagnóstico completo. Preciso de nome e email para contato."

**Ao receber dados:** "Perfeito. Digite 'criar ticket' para abrir o chamado."

## BASE DE CONHECIMENTO
${APP_KNOWLEDGE}

## EXEMPLOS DE CONVERSAS

**Ex 1 - Login:**
Usuário: "Não consigo logar"
Você: "Vou verificar. Qual erro aparece na tela?"
[resposta: "sessão expirada"]
Você: "Token expirado. Tente logout e login novamente."

**Ex 2 - Pontos:**
Usuário: "Pontos não creditaram"
Você: "Vou checar seu último corte."
[verifica banco]
Você: "Barbeiro ainda não confirmou. Pontos liberam após confirmação."

**Ex 3 - Performance:**
Usuário: "Site está lento"
Você: "Qual página está lenta?"
[resposta]
Você: "Pode limpar cache? Ctrl+Shift+Del → marcar tudo → limpar."

## SEGURANÇA

**NUNCA:**
- Executar ações destrutivas sem dupla confirmação
- Expor tokens, senhas, dados pessoais
- Modificar dados financeiros sem autorização
- Acessar informações de outros usuários

**SEMPRE:**
- Mascarar informações sensíveis
- Confirmar identidade para ações críticas  
- Logar todas as ações executadas

Seja confiante, ágil e resoluta. O usuário deve sentir que tem uma especialista técnica resolvendo o problema.`
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