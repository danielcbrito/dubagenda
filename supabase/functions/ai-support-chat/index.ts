import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ========================================
// BASE DE CONHECIMENTO EXPANDIDA
// ========================================

const APP_KNOWLEDGE = `
# SISTEMA DUB — BASE DE CONHECIMENTO COMPLETA PARA IA AUTÔNOMA

## ARQUITETURA DO SISTEMA
- Frontend: React + TypeScript + Tailwind + shadcn/ui
- Backend: Supabase (PostgreSQL + Edge Functions + Auth + Storage)
- Gateway de Pagamento: Asaas (PIX, Cartão, Boleto)
- IA: Lovable AI Gateway (Gemini)
- Notificações: WhatsApp via webhook + Evolution API

## TABELAS PRINCIPAIS (você tem acesso TOTAL)
- profiles: dados do usuário (nome, telefone, cpf, avatar_url, blocked, etc.)
- agendamentos: todos os agendamentos (data, hora, status, barbeiro_id, servico_id, preco, etc.)
- pagamentos: registros de pagamento (valor, status, metodo, gateway_payment_id, agendamento_id, assinatura_id)
- pending_bookings: reservas temporárias de PIX (expiram em 15min)
- pontos: pontos de fidelidade acumulados
- resgates: cortes grátis disponíveis
- creditos: créditos/cashback disponíveis
- assinaturas: planos de assinatura ativos
- planos: definições dos planos disponíveis
- plano_agendamentos_usos: controle de uso dos planos
- barbeiros: profissionais cadastrados (apelido, ativo, tenant_id)
- servicos: serviços oferecidos (nome, preco, duracao_minutos)
- configuracoes_horario: horários globais da barbearia
- configuracoes_horario_barbeiro: horários INDIVIDUAIS por barbeiro (FONTE DA VERDADE para disponibilidade)
- horarios_excepcionais: feriados e folgas globais
- horarios_excepcionais_barbeiro: folgas individuais por barbeiro
- support_tickets: tickets de suporte abertos
- support_conversations: conversas de suporte
- support_messages: mensagens das conversas
- webhook_logs: logs de webhooks recebidos (Asaas)
- logs_agendamentos: histórico de alterações em agendamentos
- ai_actions_log: log de ações executadas pela IA
- wallet_balances: saldo da carteira digital
- wallet_transactions: transações da carteira
- system_logs: logs gerais do sistema
- webhook_config: configurações gerais (manutenção, webhook URL, etc.)
- promocoes: promoções de fidelidade configuradas
- anuncios_app: anúncios/banners do app

## FLUXOS CRÍTICOS

### Agendamento
1. Cliente escolhe serviço(s) → data → horário → barbeiro
2. Sistema verifica disponibilidade via configuracoes_horario_barbeiro + horarios_excepcionais_barbeiro
3. Pagamento (PIX/Cartão/Dinheiro/Plano/Resgate/Crédito)
4. Status inicial: "pending" (aguardando confirmação do barbeiro)
5. Barbeiro confirma → status "confirmed"
6. Atendimento concluído → barbeiro marca "completed" → ponto de fidelidade

### REGRA CRÍTICA DE PAGAMENTOS PENDENTES
- Quando um cliente gera um PIX e NÃO paga, fica um registro em "pending_bookings" e/ou "pagamentos" com status "pending"
- Esses registros NÃO significam que o cliente DEVE algo. O PIX simplesmente expirou.
- pending_bookings expiram automaticamente após 15 minutos
- NUNCA diga ao cliente que ele tem "pagamento em aberto" se o PIX expirou sem ser pago
- Para verificar: se pagamentos.status = 'pending' E pagamentos.data_pagamento IS NULL E criado há mais de 30 min → É UM PIX EXPIRADO, NÃO UMA DÍVIDA
- Pagamentos com status 'paid' e data_pagamento preenchida = pagamento CONFIRMADO
- Pagamentos com status 'refunded' = já foram estornados
- Pagamentos com status 'pending' + agendamento cancelado = pagamento abandonado (ignorar)

### Horários e Disponibilidade
- Cada barbeiro tem sua PRÓPRIA configuração em configuracoes_horario_barbeiro
- Inclui: hora_abertura, hora_fechamento, hora_almoco_inicio, hora_almoco_fim, delay_entre_servicos
- horarios_excepcionais_barbeiro sobrepõem a configuração normal
- Um slot é ocupado se: existe agendamento não-cancelado que ocupa aquele período (hora + duração)
- Slots que INVADEM o horário de almoço são bloqueados (ex: serviço de 35min às 12:30 invade almoço às 13:00)

### Fidelidade
- 1 corte completado + confirmado pelo barbeiro = 1 ponto (exceto cortes grátis)
- Meta definida em promocoes.pontos_necessarios (geralmente 5 ou 8)
- Ao atingir meta → pontos zerados → 1 resgate criado (válido 90 dias)
- Se já tem resgate disponível, NÃO acumula mais pontos

### Planos de Assinatura
- Pagamento: PIX (Asaas), Cartão (Asaas), ou Dinheiro (na barbearia)
- Dinheiro: ativa imediatamente mas limita a 1 uso até barbeiro confirmar pagamento (cash_payment_confirmed)
- Limite mensal de agendamentos definido em planos.limite_agendamentos_mes
- Uso rastreado em plano_agendamentos_usos

## PROBLEMAS COMUNS E DIAGNÓSTICO

### "Pagamento em aberto" (FALSO POSITIVO FREQUENTE)
→ Verificar pagamentos.status = 'pending' + data_pagamento IS NULL + created_at antigo
→ Se PIX expirou: NÃO é dívida, apenas registro abandonado
→ Verificar se agendamento associado foi cancelado
→ RESPOSTA CORRETA: "Não se preocupe, aquele pagamento era apenas uma tentativa de PIX que expirou. Você não tem nenhuma pendência financeira."

### "Não consigo agendar"
→ 1. Verificar configuracoes_horario_barbeiro do barbeiro escolhido
→ 2. Verificar horarios_excepcionais_barbeiro para a data
→ 3. Verificar agendamentos existentes no dia/hora
→ 4. Verificar se o serviço existe e está ativo
→ 5. Se TODOS os usuários afetados → problema sistêmico → ticket urgente
→ 6. Se SÓ esse usuário → verificar perfil, assinatura, bloqueio

### "Pontos não creditaram"
→ Verificar agendamentos com status=completed E barbeiro_confirmou=true E ponto_liberado=false
→ Se encontrar: corrigir automaticamente
→ Se barbeiro não confirmou: informar que o barbeiro precisa finalizar o atendimento no app

### "Meu plano não está funcionando"
→ Verificar assinaturas.status = 'active'
→ Verificar plano_agendamentos_usos para ver se atingiu o limite
→ Verificar cash_payment_confirmed se for pagamento em dinheiro
→ Verificar next_billing_date (pode estar expirado)
`;

// ========================================
// FERRAMENTAS DA IA — ACESSO TOTAL
// ========================================

const AVAILABLE_TOOLS = [
  {
    type: "function",
    function: {
      name: "diagnosticar_usuario_completo",
      description: "Diagnóstico COMPLETO do usuário: perfil, agendamentos, pagamentos, pontos, resgates, créditos, assinatura, reservas pendentes. SEMPRE use como PRIMEIRA ação.",
      parameters: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "ID do usuário (UUID)" }
        },
        required: ["user_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "consultar_tabela",
      description: "Consulta QUALQUER tabela do banco de dados. Use para investigar problemas, verificar dados, entender o estado do sistema. Tabelas disponíveis: profiles, agendamentos, pagamentos, pending_bookings, pontos, resgates, creditos, assinaturas, planos, plano_agendamentos_usos, barbeiros, servicos, configuracoes_horario, configuracoes_horario_barbeiro, horarios_excepcionais, horarios_excepcionais_barbeiro, support_tickets, webhook_logs, logs_agendamentos, wallet_balances, wallet_transactions, system_logs, webhook_config, promocoes, anuncios_app, barbeiro_avaliacoes, comissoes, depositos, financial_entries.",
      parameters: {
        type: "object",
        properties: {
          tabela: { type: "string", description: "Nome da tabela" },
          filtros: {
            type: "object",
            description: "Filtros como pares chave:valor (ex: {\"user_id\": \"xxx\", \"status\": \"active\"})"
          },
          select: { type: "string", description: "Colunas a retornar (ex: 'id, nome, status'). Padrão: '*'" },
          order_by: { type: "string", description: "Coluna para ordenação (ex: 'created_at')" },
          order_asc: { type: "boolean", description: "true=ascendente, false=descendente. Padrão: false" },
          limite: { type: "number", description: "Máximo de registros. Padrão: 10" }
        },
        required: ["tabela"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "atualizar_dados",
      description: "Atualiza dados em QUALQUER tabela para corrigir problemas. Use com responsabilidade. Registra tudo no log de ações. Tabelas permitidas: agendamentos, pagamentos, pontos, resgates, profiles, assinaturas, pending_bookings, plano_agendamentos_usos, creditos.",
      parameters: {
        type: "object",
        properties: {
          tabela: { type: "string", description: "Nome da tabela" },
          filtros: { type: "object", description: "Filtros para localizar o registro (ex: {\"id\": \"xxx\"})" },
          dados: { type: "object", description: "Dados a atualizar (ex: {\"status\": \"completed\", \"ponto_liberado\": true})" },
          motivo: { type: "string", description: "Motivo da alteração (obrigatório para auditoria)" }
        },
        required: ["tabela", "filtros", "dados", "motivo"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "verificar_problema_global",
      description: "Verifica se um problema é GLOBAL (afeta todos os usuários) ou ESPECÍFICO (só um usuário). Útil para bugs de agendamento, pagamento, etc.",
      parameters: {
        type: "object",
        properties: {
          tipo_problema: {
            type: "string",
            enum: ["agendamento", "pagamento", "login", "disponibilidade", "plano"],
            description: "Tipo de problema a verificar"
          },
          data: { type: "string", description: "Data para verificar (YYYY-MM-DD), se aplicável" },
          barbeiro_id: { type: "string", description: "ID do barbeiro, se aplicável" }
        },
        required: ["tipo_problema"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "verificar_configuracao_barbeiro",
      description: "Verifica TODAS as configurações de horário de um barbeiro específico: dias de funcionamento, horários, almoço, exceções.",
      parameters: {
        type: "object",
        properties: {
          barbeiro_id: { type: "string", description: "ID do barbeiro" },
          data: { type: "string", description: "Data específica para verificar (YYYY-MM-DD), opcional" }
        },
        required: ["barbeiro_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "verificar_agendamento_especifico",
      description: "Verifica detalhes completos de um agendamento: pagamento, confirmação, logs, serviço, barbeiro.",
      parameters: {
        type: "object",
        properties: {
          agendamento_id: { type: "string", description: "ID do agendamento" }
        },
        required: ["agendamento_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "analisar_pagamentos_usuario",
      description: "Analisa TODOS os pagamentos de um usuário, separando pagos, pendentes reais, PIX expirados e abandonados. Evita falsos positivos de 'pagamento em aberto'.",
      parameters: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "ID do usuário" }
        },
        required: ["user_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "corrigir_ponto_fidelidade",
      description: "Libera ponto de fidelidade para agendamento completado mas sem ponto creditado. REQUER confirmação do usuário.",
      parameters: {
        type: "object",
        properties: {
          agendamento_id: { type: "string", description: "ID do agendamento" },
          user_id: { type: "string", description: "ID do usuário" },
          confirmado_pelo_usuario: { type: "boolean", description: "Se o usuário confirmou que o atendimento foi realizado" }
        },
        required: ["agendamento_id", "user_id", "confirmado_pelo_usuario"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "limpar_pagamentos_expirados",
      description: "Limpa registros de pagamentos PIX expirados que ficaram 'pending' para um usuário. Não afeta pagamentos reais.",
      parameters: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "ID do usuário" }
        },
        required: ["user_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "criar_ticket_automatico",
      description: "Abre ticket de suporte quando a IA não consegue resolver. NÃO pede permissão — informa que foi aberto.",
      parameters: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "ID do usuário" },
          titulo: { type: "string", description: "Título curto do problema" },
          descricao: { type: "string", description: "Descrição com diagnósticos realizados" },
          prioridade: { type: "string", enum: ["low", "medium", "high", "critical"] },
          categoria: { type: "string", enum: ["bug", "payment", "auth", "booking", "loyalty", "other"] },
          diagnosticos_realizados: { type: "object", description: "Dados dos diagnósticos feitos" }
        },
        required: ["titulo", "descricao", "prioridade", "categoria"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "reenviar_email_confirmacao",
      description: "Reenvia email de confirmação de conta.",
      parameters: {
        type: "object",
        properties: {
          user_email: { type: "string", description: "Email do usuário" }
        },
        required: ["user_email"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "executar_sql",
      description: "Executa SQL DIRETO no banco de dados PostgreSQL. Pode fazer SELECT, UPDATE, INSERT, DELETE, CREATE TABLE, ALTER TABLE, CREATE FUNCTION, DROP, etc. Acesso TOTAL ao banco. Use para investigações avançadas, correções complexas, criação de índices, etc. SEMPRE registre o motivo. Para queries destrutivas (DELETE, DROP, ALTER), tenha certeza absoluta.",
      parameters: {
        type: "object",
        properties: {
          sql: { type: "string", description: "Query SQL a executar (ex: SELECT * FROM profiles WHERE blocked = true)" },
          motivo: { type: "string", description: "Motivo da execução (obrigatório para auditoria)" }
        },
        required: ["sql", "motivo"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "listar_estrutura_banco",
      description: "Lista TODAS as tabelas do banco de dados com suas colunas, tipos e constraints. Use para entender a estrutura antes de executar SQL complexo.",
      parameters: {
        type: "object",
        properties: {
          tabela: { type: "string", description: "Nome de uma tabela específica para ver detalhes (opcional). Se vazio, lista todas as tabelas." }
        },
        required: []
      }
    }
  }
];

// ========================================
// TABELAS PERMITIDAS PARA ESCRITA
// ========================================

const WRITABLE_TABLES = [
  'agendamentos', 'pagamentos', 'pontos', 'resgates',
  'profiles', 'assinaturas', 'pending_bookings',
  'plano_agendamentos_usos', 'creditos'
];

const READABLE_TABLES = [
  'profiles', 'agendamentos', 'pagamentos', 'pending_bookings',
  'pontos', 'resgates', 'creditos', 'assinaturas', 'planos',
  'plano_agendamentos_usos', 'barbeiros', 'servicos',
  'configuracoes_horario', 'configuracoes_horario_barbeiro',
  'horarios_excepcionais', 'horarios_excepcionais_barbeiro',
  'support_tickets', 'webhook_logs', 'logs_agendamentos',
  'wallet_balances', 'wallet_transactions', 'system_logs',
  'webhook_config', 'promocoes', 'anuncios_app',
  'barbeiro_avaliacoes', 'comissoes', 'depositos',
  'financial_entries', 'categorias', 'discount_coupons',
  'discount_coupon_redemptions'
];

// ========================================
// UTILITÁRIOS
// ========================================

async function logAIAction(supabase: any, data: any) {
  try {
    await supabase.from('ai_actions_log').insert(data);
  } catch (e) {
    console.error('Erro ao logar ação:', e);
  }
}

async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 1000): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) await new Promise(r => setTimeout(r, initialDelay * Math.pow(2, attempt)));
    }
  }
  throw lastError;
}

// ========================================
// IMPLEMENTAÇÃO DAS FUNÇÕES
// ========================================

async function executeFunction(functionName: string, args: any, supabase: any, conversationId: string) {
  console.log(`🔧 Executando: ${functionName}`, JSON.stringify(args).slice(0, 500));

  const actionLog: any = {
    conversation_id: conversationId,
    user_id: args.user_id || null,
    action_type: 'function_call',
    action_name: functionName,
    parameters: args,
    success: false,
    created_at: new Date().toISOString()
  };

  try {
    let result: any;

    switch (functionName) {

      // ========================================
      // DIAGNÓSTICO COMPLETO
      // ========================================
      case "diagnosticar_usuario_completo": {
        const { user_id } = args;

        const [
          { data: profile },
          { data: appointments },
          { data: payments },
          { data: points },
          { data: redemptions },
          { data: credits },
          { data: subscription },
          { data: pendingBookings },
          { data: recentLogs },
          { data: planUses }
        ] = await Promise.all([
          supabase.from('profiles').select('nome, telefone, blocked, cpf, created_at, avatar_url').eq('id', user_id).single(),
          supabase.from('agendamentos').select('id, data, hora, status, barbeiro_confirmou, cliente_confirmou, ponto_liberado, is_free, preco, payment_method, tipo_agendamento, servico_id, barbeiro_id, observacoes, created_at, cancelado_em').eq('user_id', user_id).order('data', { ascending: false }).limit(15),
          supabase.from('pagamentos').select('id, valor, status, metodo, created_at, data_pagamento, gateway_payment_id, agendamento_id, assinatura_id').eq('user_id', user_id).order('created_at', { ascending: false }).limit(10),
          supabase.from('pontos').select('pontos, last_awarded_at, promocao_id').eq('user_id', user_id).single(),
          supabase.from('resgates').select('id, status, created_at, expired_at, used_at, appointment_id').eq('user_id', user_id).order('created_at', { ascending: false }).limit(5),
          supabase.from('creditos').select('id, valor, origem, usado, expires_at, created_at').eq('user_id', user_id).eq('usado', false),
          supabase.from('assinaturas').select('id, status, next_billing_date, plano_id, payment_method, cash_payment_confirmed, created_at').eq('user_id', user_id).order('created_at', { ascending: false }).limit(3),
          supabase.from('pending_bookings').select('*').eq('user_id', user_id).order('created_at', { ascending: false }).limit(5),
          supabase.from('system_logs').select('level, message, category, created_at').eq('user_id', user_id).in('level', ['error', 'warn']).order('created_at', { ascending: false }).limit(5),
          supabase.from('plano_agendamentos_usos').select('id, agendamento_id, competencia, released_at, created_at').eq('user_id', user_id).order('created_at', { ascending: false }).limit(10)
        ]);

        // Análise inteligente
        const issues: string[] = [];
        const now = new Date();

        if (profile?.blocked) issues.push('⚠️ CONTA BLOQUEADA');

        // Pontos não creditados
        const missingPoints = appointments?.filter((a: any) =>
          a.status === 'completed' && a.barbeiro_confirmou === true && !a.ponto_liberado && !a.is_free
        );
        if (missingPoints?.length > 0) issues.push(`${missingPoints.length} agendamento(s) completado(s) sem ponto creditado — pode corrigir automaticamente`);

        // Pagamentos (uso interno de diagnóstico, sem expor como problema por padrão)
        const realPending: any[] = [];
        const expiredPix: any[] = [];
        payments?.forEach((p: any) => {
          if (p.status === 'pending' && !p.data_pagamento) {
            const created = new Date(p.created_at);
            const diffMin = (now.getTime() - created.getTime()) / 60000;
            if (diffMin > 30) {
              expiredPix.push(p);
            } else {
              realPending.push(p);
            }
          }
        });

        // Resgates expirados
        const expiredRedemptions = redemptions?.filter((r: any) =>
          r.status === 'available' && new Date(r.expired_at) < now
        );
        if (expiredRedemptions?.length > 0) issues.push(`${expiredRedemptions.length} resgate(s) expirado(s)`);

        // Assinatura
        const activeSub = subscription?.find((s: any) => s.status === 'active');
        const pendingSub = subscription?.find((s: any) => s.status === 'pending_cash');

        // Plan uses
        const activeUses = planUses?.filter((u: any) => !u.released_at) || [];

        result = {
          perfil: {
            nome: profile?.nome,
            telefone: profile?.telefone,
            bloqueado: profile?.blocked,
            cpf: profile?.cpf ? '***' + profile.cpf.slice(-4) : null,
            cliente_desde: profile?.created_at
          },
          resumo: {
            pontos_atuais: points?.pontos || 0,
            resgates_disponiveis: redemptions?.filter((r: any) => r.status === 'available' && new Date(r.expired_at) > now).length || 0,
            creditos_disponiveis: credits?.reduce((sum: number, c: any) => sum + Number(c.valor), 0) || 0,
            tem_assinatura: !!activeSub,
            status_assinatura: activeSub?.status || pendingSub?.status || 'nenhuma',
            plano_id: activeSub?.plano_id || pendingSub?.plano_id,
            usos_plano_ativos: activeUses.length,
            cash_confirmed: activeSub?.cash_payment_confirmed
          },
          agendamentos_recentes: appointments?.slice(0, 8),
          pagamentos: {
            total_registros: payments?.length || 0,
            confirmados_count: payments?.filter((p: any) => p.status === 'paid').length || 0,
            pendentes_reais_count: realPending.length,
            pix_expirados_count: expiredPix.length
          },
          reservas_pendentes: pendingBookings,
          problemas_detectados: issues,
          erros_recentes: recentLogs,
          agendamentos_sem_ponto: missingPoints?.map((a: any) => ({ id: a.id, data: a.data }))
        };
        break;
      }

      // ========================================
      // CONSULTAR QUALQUER TABELA
      // ========================================
      case "consultar_tabela": {
        const { tabela, filtros, select, order_by, order_asc, limite } = args;

        if (!READABLE_TABLES.includes(tabela)) {
          result = { erro: `Tabela '${tabela}' não está disponível para consulta. Tabelas disponíveis: ${READABLE_TABLES.join(', ')}` };
          break;
        }

        let query = supabase.from(tabela).select(select || '*');

        if (filtros && typeof filtros === 'object') {
          for (const [key, value] of Object.entries(filtros)) {
            if (value === null) {
              query = query.is(key, null);
            } else if (typeof value === 'boolean') {
              query = query.eq(key, value);
            } else {
              query = query.eq(key, value);
            }
          }
        }

        if (order_by) {
          query = query.order(order_by, { ascending: order_asc ?? false });
        }

        query = query.limit(limite || 10);

        const { data, error } = await query;
        if (error) {
          result = { erro: error.message };
        } else {
          result = { tabela, total_registros: data?.length || 0, dados: data };
        }
        break;
      }

      // ========================================
      // ATUALIZAR DADOS (COM AUDITORIA)
      // ========================================
      case "atualizar_dados": {
        const { tabela, filtros, dados, motivo } = args;

        if (!WRITABLE_TABLES.includes(tabela)) {
          result = { erro: `Tabela '${tabela}' não é editável pela IA. Tabelas editáveis: ${WRITABLE_TABLES.join(', ')}` };
          break;
        }

        if (!motivo) {
          result = { erro: 'Motivo é obrigatório para alterações' };
          break;
        }

        // Buscar estado anterior
        let beforeQuery = supabase.from(tabela).select('*');
        for (const [key, value] of Object.entries(filtros)) {
          beforeQuery = beforeQuery.eq(key, value);
        }
        const { data: beforeData } = await beforeQuery;

        if (!beforeData || beforeData.length === 0) {
          result = { erro: 'Registro não encontrado com os filtros fornecidos' };
          break;
        }

        // Executar update
        let updateQuery = supabase.from(tabela).update(dados);
        for (const [key, value] of Object.entries(filtros)) {
          updateQuery = updateQuery.eq(key, value);
        }
        const { error: updateError, data: afterData } = await updateQuery.select();

        if (updateError) {
          result = { erro: updateError.message };
          break;
        }

        // Log de auditoria
        actionLog.before_state = beforeData[0];
        actionLog.after_state = afterData?.[0] || dados;

        await supabase.from('ai_actions_log').insert({
          conversation_id: conversationId,
          user_id: args.user_id || beforeData[0]?.user_id || null,
          action_type: 'data_update',
          action_name: `update_${tabela}`,
          parameters: { tabela, filtros, dados, motivo },
          before_state: beforeData[0],
          after_state: afterData?.[0] || dados,
          success: true,
          auto_approved: true,
          created_at: new Date().toISOString()
        });

        result = {
          sucesso: true,
          tabela,
          registros_afetados: afterData?.length || 1,
          motivo,
          antes: beforeData[0],
          depois: afterData?.[0] || dados
        };
        break;
      }

      // ========================================
      // VERIFICAR PROBLEMA GLOBAL
      // ========================================
      case "verificar_problema_global": {
        const { tipo_problema, data: dataStr, barbeiro_id } = args;
        const now = new Date();
        const today = now.toISOString().split('T')[0];

        switch (tipo_problema) {
          case "agendamento": {
            // Verificar agendamentos criados nas últimas 2h
            const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
            const { data: recentBookings } = await supabase
              .from('agendamentos')
              .select('id, user_id, status, created_at')
              .gte('created_at', twoHoursAgo)
              .order('created_at', { ascending: false })
              .limit(20);

            const { data: recentErrors } = await supabase
              .from('system_logs')
              .select('message, category, created_at')
              .eq('level', 'error')
              .gte('created_at', twoHoursAgo)
              .limit(10);

            const uniqueUsers = new Set(recentBookings?.map((b: any) => b.user_id));

            result = {
              tipo: 'agendamento',
              agendamentos_recentes_2h: recentBookings?.length || 0,
              usuarios_distintos: uniqueUsers.size,
              erros_recentes: recentErrors?.length || 0,
              detalhes_erros: recentErrors?.slice(0, 5),
              sistema_funcionando: (recentBookings?.length || 0) > 0 && (recentErrors?.length || 0) === 0,
              diagnostico: (recentBookings?.length || 0) === 0 && (recentErrors?.length || 0) > 0
                ? 'POSSÍVEL PROBLEMA GLOBAL — sem agendamentos recentes e erros detectados'
                : 'Sistema aparenta estar funcionando normalmente'
            };
            break;
          }

          case "disponibilidade": {
            const targetDate = dataStr || today;
            let query = supabase.from('agendamentos')
              .select('id, hora, barbeiro_id, status')
              .eq('data', targetDate)
              .not('status', 'in', '("cancelled_by_user","cancelled_by_admin")');

            if (barbeiro_id) query = query.eq('barbeiro_id', barbeiro_id);
            const { data: dayAppointments } = await query;

            // Verificar configuração
            const dayOfWeek = new Date(targetDate + 'T12:00:00').getDay();
            let configQuery = supabase.from('configuracoes_horario_barbeiro')
              .select('*')
              .eq('dia_semana', dayOfWeek);
            if (barbeiro_id) configQuery = configQuery.eq('barbeiro_id', barbeiro_id);
            const { data: configs } = await configQuery;

            // Exceções
            let excQuery = supabase.from('horarios_excepcionais_barbeiro').select('*').eq('data', targetDate);
            if (barbeiro_id) excQuery = excQuery.eq('barbeiro_id', barbeiro_id);
            const { data: exceptions } = await excQuery;

            result = {
              data: targetDate,
              dia_semana: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][dayOfWeek],
              agendamentos_no_dia: dayAppointments?.length || 0,
              horarios_ocupados: dayAppointments?.map((a: any) => `${a.hora} (${a.status})`),
              configuracoes: configs,
              excecoes: exceptions,
              barbeiros_fechados: configs?.filter((c: any) => !c.aberto).length || 0
            };
            break;
          }

          case "pagamento": {
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
            const { data: recentPayments } = await supabase
              .from('pagamentos')
              .select('id, status, metodo, created_at')
              .gte('created_at', oneHourAgo)
              .order('created_at', { ascending: false })
              .limit(20);

            const paid = recentPayments?.filter((p: any) => p.status === 'paid').length || 0;
            const pending = recentPayments?.filter((p: any) => p.status === 'pending').length || 0;
            const failed = recentPayments?.filter((p: any) => p.status === 'failed').length || 0;

            result = {
              tipo: 'pagamento',
              ultima_hora: { total: recentPayments?.length, pagos: paid, pendentes: pending, falhados: failed },
              gateway_funcionando: paid > 0 || (pending > 0 && failed === 0),
              diagnostico: failed > 2 ? 'POSSÍVEL PROBLEMA NO GATEWAY — múltiplas falhas' : 'Gateway aparenta estar normal'
            };
            break;
          }

          default:
            result = { erro: 'Tipo de problema não reconhecido' };
        }
        break;
      }

      // ========================================
      // VERIFICAR CONFIGURAÇÃO DO BARBEIRO
      // ========================================
      case "verificar_configuracao_barbeiro": {
        const { barbeiro_id, data: dataStr } = args;

        const [
          { data: barber },
          { data: configs },
          { data: exceptions }
        ] = await Promise.all([
          supabase.from('barbeiros').select('id, apelido, ativo, tenant_id').eq('id', barbeiro_id).single(),
          supabase.from('configuracoes_horario_barbeiro').select('*').eq('barbeiro_id', barbeiro_id).order('dia_semana', { ascending: true }),
          supabase.from('horarios_excepcionais_barbeiro').select('*').eq('barbeiro_id', barbeiro_id).order('data', { ascending: false }).limit(10)
        ]);

        let dayConfig = null;
        let dayException = null;
        if (dataStr) {
          const dow = new Date(dataStr + 'T12:00:00').getDay();
          dayConfig = configs?.find((c: any) => c.dia_semana === dow);
          dayException = exceptions?.find((e: any) => e.data === dataStr);
        }

        result = {
          barbeiro: barber,
          configuracoes_semanais: configs,
          excecoes_recentes: exceptions,
          ...(dataStr ? {
            data_consultada: dataStr,
            configuracao_do_dia: dayException || dayConfig,
            tem_excecao: !!dayException,
            aberto: dayException ? dayException.aberto : dayConfig?.aberto
          } : {})
        };
        break;
      }

      // ========================================
      // VERIFICAR AGENDAMENTO ESPECÍFICO
      // ========================================
      case "verificar_agendamento_especifico": {
        const { agendamento_id } = args;

        const [
          { data: appointment },
          { data: payment },
          { data: logs }
        ] = await Promise.all([
          supabase.from('agendamentos').select('*, servicos(nome, preco, duracao_minutos), barbeiros(apelido)').eq('id', agendamento_id).single(),
          supabase.from('pagamentos').select('*').eq('agendamento_id', agendamento_id).order('created_at', { ascending: false }).limit(1),
          supabase.from('logs_agendamentos').select('*').eq('agendamento_id', agendamento_id).order('timestamp', { ascending: false }).limit(10)
        ]);

        if (!appointment) {
          result = { erro: 'Agendamento não encontrado' };
          break;
        }

        result = {
          agendamento: appointment,
          servico: appointment.servicos,
          barbeiro: appointment.barbeiros,
          pagamento: payment?.[0] || null,
          historico_alteracoes: logs
        };
        break;
      }

      // ========================================
      // ANALISAR PAGAMENTOS (INTELIGENTE)
      // ========================================
      case "analisar_pagamentos_usuario": {
        const { user_id } = args;
        const now = new Date();

        const { data: payments } = await supabase
          .from('pagamentos')
          .select('id, valor, status, metodo, created_at, data_pagamento, gateway_payment_id, agendamento_id, assinatura_id')
          .eq('user_id', user_id)
          .order('created_at', { ascending: false })
          .limit(20);

        const analysis = {
          pagos: [] as any[],
          pendentes_reais: [] as any[],
          pix_expirados: [] as any[],
          abandonados: [] as any[],
          estornados: [] as any[]
        };

        for (const p of (payments || [])) {
          if (p.status === 'paid') {
            analysis.pagos.push(p);
          } else if (p.status === 'refunded') {
            analysis.estornados.push(p);
          } else if (p.status === 'pending') {
            const created = new Date(p.created_at);
            const diffMin = (now.getTime() - created.getTime()) / 60000;

            // Verificar se agendamento associado foi cancelado
            if (p.agendamento_id) {
              const { data: apt } = await supabase
                .from('agendamentos')
                .select('status')
                .eq('id', p.agendamento_id)
                .single();
              if (apt?.status?.includes('cancelled')) {
                analysis.abandonados.push({ ...p, motivo: 'agendamento cancelado' });
                continue;
              }
            }

            if (diffMin > 30 && !p.data_pagamento) {
              analysis.pix_expirados.push({ ...p, minutos_desde_criacao: Math.round(diffMin) });
            } else {
              analysis.pendentes_reais.push(p);
            }
          }
        }

        result = {
          resumo: {
            total: payments?.length || 0,
            pagos: analysis.pagos.length,
            pendentes_reais: analysis.pendentes_reais.length,
            pix_expirados: analysis.pix_expirados.length,
            abandonados: analysis.abandonados.length,
            estornados: analysis.estornados.length,
            tem_divida_real: analysis.pendentes_reais.length > 0
          },
          detalhes: analysis,
          conclusao: analysis.pendentes_reais.length === 0
            ? 'Cliente NÃO tem nenhuma pendência financeira real. PIX expirados são apenas registros abandonados.'
            : `Cliente tem ${analysis.pendentes_reais.length} pagamento(s) pendente(s) recente(s) que podem estar aguardando confirmação do gateway.`
        };
        break;
      }

      // ========================================
      // CORRIGIR PONTO DE FIDELIDADE
      // ========================================
      case "corrigir_ponto_fidelidade": {
        const { agendamento_id, user_id, confirmado_pelo_usuario } = args;

        if (!confirmado_pelo_usuario) {
          result = { sucesso: false, requer_confirmacao: true, mensagem: 'Preciso que você confirme que o atendimento foi realizado antes de liberar o ponto.' };
          break;
        }

        const { data: appointment } = await supabase
          .from('agendamentos')
          .select('*')
          .eq('id', agendamento_id)
          .eq('user_id', user_id)
          .single();

        if (!appointment) { result = { sucesso: false, erro: 'Agendamento não encontrado' }; break; }
        if (appointment.ponto_liberado) { result = { sucesso: false, erro: 'Ponto já foi creditado' }; break; }
        if (appointment.is_free) { result = { sucesso: false, erro: 'Cortes grátis não geram pontos' }; break; }

        // Atualizar agendamento
        await supabase.from('agendamentos').update({
          ponto_liberado: true,
          barbeiro_confirmou: true,
          status: 'completed'
        }).eq('id', agendamento_id);

        // Atualizar pontos
        const { data: currentPoints } = await supabase.from('pontos').select('pontos').eq('user_id', user_id).single();

        if (currentPoints) {
          await supabase.from('pontos').update({
            pontos: currentPoints.pontos + 1,
            last_awarded_at: new Date().toISOString()
          }).eq('user_id', user_id);
        } else {
          await supabase.from('pontos').insert({ user_id, pontos: 1, last_awarded_at: new Date().toISOString() });
        }

        actionLog.before_state = { ponto_liberado: false, pontos: currentPoints?.pontos || 0 };
        actionLog.after_state = { ponto_liberado: true, pontos: (currentPoints?.pontos || 0) + 1 };

        result = { sucesso: true, mensagem: 'Ponto creditado com sucesso!', novos_pontos: (currentPoints?.pontos || 0) + 1 };
        break;
      }

      // ========================================
      // LIMPAR PAGAMENTOS EXPIRADOS
      // ========================================
      case "limpar_pagamentos_expirados": {
        const { user_id } = args;
        const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

        // Limpar pending_bookings expirados
        const { data: expiredBookings } = await supabase
          .from('pending_bookings')
          .delete()
          .eq('user_id', user_id)
          .lt('expires_at', new Date().toISOString())
          .select();

        // Marcar pagamentos PIX antigos como expirados
        const { data: expiredPayments } = await supabase
          .from('pagamentos')
          .update({ status: 'expired' })
          .eq('user_id', user_id)
          .eq('status', 'pending')
          .is('data_pagamento', null)
          .lt('created_at', thirtyMinAgo)
          .select();

        result = {
          sucesso: true,
          reservas_limpas: expiredBookings?.length || 0,
          pagamentos_marcados_expirados: expiredPayments?.length || 0,
          mensagem: 'Registros antigos limpos com sucesso. Nenhuma pendência real.'
        };
        break;
      }

      // ========================================
      // REENVIAR EMAIL
      // ========================================
      case "reenviar_email_confirmacao": {
        const { user_email } = args;
        const { error } = await supabase.functions.invoke('send-confirmation-email', { body: { email: user_email } });
        result = error ? { sucesso: false, erro: error.message } : { sucesso: true, mensagem: 'Email reenviado' };
        break;
      }

      // ========================================
      // CRIAR TICKET
      // ========================================
      case "criar_ticket_automatico": {
        const { user_id, titulo, descricao, prioridade, categoria, diagnosticos_realizados } = args;

        try {
          const { data: ticket, error } = await retryWithBackoff(async () => {
            return await supabase.from('support_tickets').insert({
              user_id: user_id || null,
              conversation_id: conversationId,
              title: titulo,
              description: descricao,
              priority: prioridade,
              category: categoria,
              status: 'open',
              metadata: { created_by_ai: true, auto_created: true, diagnosticos: diagnosticos_realizados, timestamp: new Date().toISOString() }
            }).select().single();
          }, 3, 2000);

          if (error) throw error;
          result = { sucesso: true, ticket_id: ticket.id, protocolo: ticket.id.substring(0, 8).toUpperCase(), mensagem: `Ticket aberto — protocolo ${ticket.id.substring(0, 8).toUpperCase()}` };
        } catch (error: any) {
          const pendingId = `PT-${Date.now()}`;
          await supabase.from('pending_tickets').insert({
            pending_ticket_id: pendingId,
            conversation_id: conversationId,
            user_id,
            summary: titulo,
            description: descricao,
            priority: prioridade,
            category: categoria,
            status: 'pending',
            last_error: error.message,
            payload: { diagnosticos_realizados }
          }).catch(() => {});

          result = { sucesso: true, pending: true, protocolo: pendingId, mensagem: `Registrei seu caso (${pendingId}) — suporte foi notificado` };
        }
        break;
      }

      // ========================================
      // EXECUTAR SQL DIRETO
      // ========================================
      case "executar_sql": {
        const { sql, motivo } = args;

        if (!motivo) {
          result = { erro: 'Motivo é obrigatório para executar SQL' };
          break;
        }

        // Bloquear operações ultra-destrutivas
        const sqlUpper = sql.toUpperCase().trim();
        const blocked = ['DROP DATABASE', 'DROP SCHEMA', 'TRUNCATE ALL', 'DELETE FROM auth.', 'DROP TABLE auth.', 'ALTER TABLE auth.'];
        if (blocked.some(b => sqlUpper.includes(b))) {
          result = { erro: 'Operação bloqueada por segurança. Tabelas do schema auth e operações destrutivas globais não são permitidas.' };
          break;
        }

        const dbUrl = Deno.env.get('SUPABASE_DB_URL');
        if (!dbUrl) {
          result = { erro: 'SUPABASE_DB_URL não configurado' };
          break;
        }

        let sqlConn;
        try {
          sqlConn = postgres(dbUrl, { max: 1, idle_timeout: 5 });
          const rows = await sqlConn.unsafe(sql);

          // Log de auditoria
          await supabase.from('ai_actions_log').insert({
            conversation_id: conversationId,
            user_id: args.user_id || null,
            action_type: 'raw_sql',
            action_name: 'executar_sql',
            parameters: { sql: sql.slice(0, 1000), motivo },
            result: { rows_count: rows?.length || 0, sample: JSON.stringify(rows?.slice?.(0, 5) || rows).slice(0, 2000) },
            success: true,
            auto_approved: true,
            created_at: new Date().toISOString()
          });

          const isSelect = sqlUpper.startsWith('SELECT') || sqlUpper.startsWith('WITH');
          result = {
            sucesso: true,
            tipo: isSelect ? 'consulta' : 'execução',
            registros: rows?.length || 0,
            dados: rows?.slice?.(0, 50) || rows,
            motivo
          };
        } catch (sqlError: any) {
          console.error('SQL Error:', sqlError);
          result = { sucesso: false, erro: sqlError.message, sql_enviado: sql.slice(0, 200) };
        } finally {
          if (sqlConn) await sqlConn.end().catch(() => {});
        }
        break;
      }

      // ========================================
      // LISTAR ESTRUTURA DO BANCO
      // ========================================
      case "listar_estrutura_banco": {
        const { tabela } = args;
        const dbUrl = Deno.env.get('SUPABASE_DB_URL');
        if (!dbUrl) { result = { erro: 'SUPABASE_DB_URL não configurado' }; break; }

        let sqlConn;
        try {
          sqlConn = postgres(dbUrl, { max: 1, idle_timeout: 5 });

          if (tabela) {
            // Detalhes de uma tabela específica
            const columns = await sqlConn.unsafe(`
              SELECT column_name, data_type, is_nullable, column_default, 
                     character_maximum_length, udt_name
              FROM information_schema.columns 
              WHERE table_schema = 'public' AND table_name = '${tabela.replace(/'/g, "''")}'
              ORDER BY ordinal_position
            `);

            const constraints = await sqlConn.unsafe(`
              SELECT tc.constraint_name, tc.constraint_type, kcu.column_name,
                     ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
              FROM information_schema.table_constraints tc
              JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
              LEFT JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
              WHERE tc.table_schema = 'public' AND tc.table_name = '${tabela.replace(/'/g, "''")}'
            `);

            const indexes = await sqlConn.unsafe(`
              SELECT indexname, indexdef FROM pg_indexes 
              WHERE schemaname = 'public' AND tablename = '${tabela.replace(/'/g, "''")}'
            `);

            const policies = await sqlConn.unsafe(`
              SELECT policyname, cmd, qual, with_check 
              FROM pg_policies 
              WHERE schemaname = 'public' AND tablename = '${tabela.replace(/'/g, "''")}'
            `);

            result = {
              tabela,
              colunas: columns,
              constraints,
              indices: indexes,
              politicas_rls: policies,
              total_colunas: columns.length
            };
          } else {
            // Listar todas as tabelas
            const tables = await sqlConn.unsafe(`
              SELECT table_name, 
                     (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.table_schema = 'public') as column_count
              FROM information_schema.tables t
              WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
              ORDER BY table_name
            `);

            const views = await sqlConn.unsafe(`
              SELECT table_name FROM information_schema.views WHERE table_schema = 'public' ORDER BY table_name
            `);

            const functions = await sqlConn.unsafe(`
              SELECT routine_name, data_type as return_type
              FROM information_schema.routines 
              WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
              ORDER BY routine_name
            `);

            result = {
              tabelas: tables,
              views: views,
              funcoes: functions?.slice(0, 30),
              total_tabelas: tables.length,
              total_views: views.length,
              total_funcoes: functions?.length || 0
            };
          }
        } catch (sqlError: any) {
          result = { sucesso: false, erro: sqlError.message };
        } finally {
          if (sqlConn) await sqlConn.end().catch(() => {});
        }
        break;
      }

      default:
        result = { erro: `Função '${functionName}' não encontrada` };
    }

    actionLog.success = true;
    actionLog.result = typeof result === 'string' ? result : JSON.stringify(result).slice(0, 2000);
    await logAIAction(supabase, actionLog);

    return JSON.stringify(result);

  } catch (error: any) {
    console.error(`❌ Erro em ${functionName}:`, error);
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
    const { message, conversationId, guestName, guestEmail } = await req.json();

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
      user = { id: `guest-${Date.now()}`, email: guestEmail };
    }

    console.log('📩 Mensagem:', { userId: user.id, isGuest, msg: message?.slice(0, 100) });

    // Buscar ou criar conversa
    let conversation;
    if (conversationId) {
      const { data } = await supabase.from('support_conversations').select('*').eq('id', conversationId).single();
      conversation = data;
    }

    if (!conversation) {
      const { data: newConv } = await supabase.from('support_conversations').insert({
        user_id: isGuest ? null : user.id,
        status: 'active',
        metadata: isGuest ? { guest_name: guestName, guest_email: guestEmail, is_guest: true } : {}
      }).select().single();
      conversation = newConv;
    }

    // Salvar mensagem
    await supabase.from('support_messages').insert({ conversation_id: conversation.id, role: 'user', content: message });

    // Histórico
    const { data: allMessages } = await supabase
      .from('support_messages')
      .select('role, content')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .limit(40);

    const conversationHistory = allMessages?.map(msg => ({ role: msg.role, content: msg.content })) || [];

    // ========================================
    // SYSTEM PROMPT — IA LIBERAL E INTELIGENTE
    // ========================================

    const now = new Date();
    const brazilTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const todayFormatted = brazilTime.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    const tomorrowDate = new Date(brazilTime);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowFormatted = tomorrowDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    const currentTime = brazilTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const systemPrompt = `# AGENTE DE SUPORTE AUTÔNOMO — DUB

Você é a IA de suporte do sistema DUB. Tem acesso ao banco de dados para CONSULTAR e DIAGNOSTICAR problemas. Sua missão: ajudar o cliente a resolver seu problema de forma rápida e amigável.

## ⏰ DATA E HORA ATUAIS (BRASIL - São Paulo)
- **HOJE**: ${todayFormatted}
- **AMANHÃ**: ${tomorrowFormatted}
- **HORA ATUAL**: ${currentTime}
- SEMPRE use essas referências ao falar de datas. Se o cliente disser "amanhã", use a data de AMANHÃ acima. NUNCA invente datas.

## PERSONALIDADE
- Fale em português SIMPLES e DIRETO
- Nada de termos técnicos pro cliente
- Resposta CURTA: no máximo 2 frases e até 280 caracteres (exceto bloco de escalação WhatsApp)
- NÃO use listas numeradas longas, a menos que o cliente peça

## ⚠️ REGRAS DE SEGURANÇA — PROIBIÇÕES ABSOLUTAS ⚠️

### NUNCA FAÇA:
- **NÃO MENCIONE pagamentos pendentes, PIX expirados ou dívidas PROATIVAMENTE.** Só fale sobre pagamentos se o CLIENTE perguntar explicitamente sobre isso.
- **NÃO TOME DECISÕES SOBRE PAGAMENTOS.** Nunca diga que o cliente "deve" dinheiro, tem "pendência financeira", ou precisa pagar algo.
- **NÃO ALTERE status de pagamentos.** Pagamentos são gerenciados exclusivamente pelo gateway (Asaas) e pelo administrador.
- **NÃO CANCELE agendamentos** por conta própria sem o cliente pedir explicitamente.
- **NÃO MODIFIQUE valores financeiros** (preços, créditos, saldos).
- **NÃO FALE sobre problemas internos do sistema** para o cliente (bugs, erros de banco, inconsistências técnicas).
- **NÃO EXPONHA dados técnicos** (IDs, UUIDs, nomes de tabelas, queries SQL) para o cliente.
- **NÃO RELATE informações financeiras do diagnóstico ao cliente** a menos que ele pergunte especificamente. Se o diagnóstico mostrar PIX expirados ou pagamentos abandonados, IGNORE — não são problemas reais.

### SOBRE PAGAMENTOS PENDENTES:
- PIX gerado e não pago em 30+ minutos = EXPIRADO = NÃO É DÍVIDA = IGNORE COMPLETAMENTE
- Pagamento pending + agendamento cancelado = ABANDONADO = NÃO É DÍVIDA = IGNORE
- **NUNCA diga ao cliente que ele tem pagamento em aberto se o PIX simplesmente expirou**
- Se o cliente perguntar sobre pagamentos, diga: "Verifiquei aqui e está tudo certo, sem pendências! 😊"

## REGRAS DE OURO

### 1. DIAGNÓSTICO PRIMEIRO — SEMPRE
- SEMPRE use \`diagnosticar_usuario_completo\` como PRIMEIRA ação
- Analise TUDO antes de responder
- NÃO faça perguntas que você pode responder consultando os dados
- Quando ver dados de pagamentos no diagnóstico, **NÃO relate informações financeiras ao cliente** a menos que ele pergunte

### 2. INVESTIGAÇÃO PROFUNDA
- Se o problema é de agendamento → use \`verificar_configuracao_barbeiro\` + \`verificar_problema_global\`
- Se o problema é de pagamento E O CLIENTE PERGUNTOU → use \`analisar_pagamentos_usuario\`
- Se precisa de dados específicos → use \`consultar_tabela\` para QUALQUER tabela
- Se suspeita de bug → use \`verificar_problema_global\` para checar se é só esse cliente ou todos

### 3. PEDIR PRINTS E IMAGENS — INTELIGÊNCIA VISUAL 📸
- Quando o problema não ficar 100% claro, peça PRINT imediatamente
- Faça apenas 1 pergunta por vez (priorize: "Pode me mandar um print da tela com o erro? 📸")
- Evite perguntar barbeiro/serviço/data no primeiro retorno; investigue primeiro nos dados
- Se o cliente enviar imagem/arquivo (URL no chat), use isso para diagnosticar

### 4. RESOLUÇÃO SEGURA
Você PODE resolver sozinha (coisas seguras):
- Corrigir pontos de fidelidade não creditados (com confirmação do cliente)
- Limpar registros de PIX expirados que causam confusão visual
- Informar status de agendamentos, planos, pontos
- Explicar como usar o app
- Responder dúvidas gerais

### 5. FOCO NA RESOLUÇÃO
- Primeiro: diga o que você já verificou e a ação prática
- Segundo: peça print só se necessário
- NUNCA enviar questionário com várias perguntas de uma vez

### 6. ESCALAÇÃO PARA WHATSAPP — REGRA CRÍTICA 🚀

Quando você NÃO CONSEGUIR RESOLVER o problema do cliente, ou quando o problema envolver:
- Questões financeiras complexas (estornos, cobranças, problemas de pagamento)
- Bugs que você não pode corrigir
- Reclamações sérias
- Qualquer situação que precise de intervenção humana
- O cliente pedir para falar com uma pessoa

Você DEVE encerrar a conversa direcionando o cliente para o WhatsApp do administrador com um resumo pré-escrito.

**FORMATO OBRIGATÓRIO da mensagem de escalação:**

Responda algo como:
"Entendo seu problema! Vou te direcionar para nosso suporte humano que vai resolver isso rapidinho. 💬

Toque no botão abaixo — a mensagem já está pronta, é só enviar:

[WHATSAPP_ESCALATION]
Olá! Preciso de ajuda com meu atendimento no DUB.

📋 Resumo do problema:
{descrição clara e resumida do problema do cliente}

👤 Cliente: {nome do cliente}
📧 Email: {email}
🆔 Protocolo: {conversation_id}
[/WHATSAPP_ESCALATION]

Nosso time vai te responder o mais rápido possível! 🙏"

**IMPORTANTE:** O bloco [WHATSAPP_ESCALATION]...[/WHATSAPP_ESCALATION] será automaticamente convertido em um botão de WhatsApp na interface. O texto dentro do bloco é a mensagem que será enviada ao administrador.

## DADOS DO CONTEXTO
- **Usuário**: ${!isGuest ? user.id : 'visitante (não logado)'}
- **Email**: ${user.email || 'não disponível'}
- **Conversa**: ${conversation.id}
- **Logado**: ${!isGuest ? 'Sim' : 'Não'}

## BASE DE CONHECIMENTO
${APP_KNOWLEDGE}

## REGRAS FINAIS
1. Se usuário NÃO está logado → pode dar informações gerais mas não acessar dados pessoais
2. Se conta bloqueada → escale para WhatsApp IMEDIATAMENTE
3. Se problema financeiro real → escale para WhatsApp
4. NUNCA diga "não tenho acesso" — você TEM acesso para CONSULTAR dados
5. NUNCA peça dados que pode buscar sozinha
6. Se não consegue resolver → ESCALE para WhatsApp com resumo completo
7. Se resolver → confirme com confiança: "Pronto, tá resolvido!"
8. NUNCA tome decisões sobre dinheiro ou pagamentos do cliente
9. NUNCA mencione pagamentos pendentes/expirados proativamente — SÓ se o cliente perguntar
10. Use SEMPRE as datas corretas de HOJE e AMANHÃ informadas acima — NUNCA invente datas`;

    // ========================================
    // CHAMADA DA IA
    // ========================================

    const initialPayload = {
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationHistory
      ],
      tools: AVAILABLE_TOOLS,
      temperature: 0.5,
      max_tokens: 2000
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
      const errorText = await aiResponse.text();
      console.error('AI Error:', aiResponse.status, errorText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit', response: 'Estou recebendo muitas mensagens agora. Aguarde um minutinho e tente de novo! 😊' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      throw new Error(`AI error: ${aiResponse.status}`);
    }

    let aiData = await aiResponse.json();
    let choice = aiData.choices[0];
    let iterations = 0;
    const maxIterations = 12; // Mais iterações para resolver problemas complexos

    // Acumular mensagens para contexto
    const messageHistory = [...initialPayload.messages];

    // ========================================
    // LOOP DE TOOL CALLING
    // ========================================

    while (choice.finish_reason === 'tool_calls' && iterations < maxIterations) {
      iterations++;
      console.log(`🔄 Iteração ${iterations}/${maxIterations}`);

      const toolCalls = choice.message.tool_calls;
      const toolResults = [];

      // Executar tools em paralelo quando possível
      const promises = toolCalls.map(async (toolCall: any) => {
        const functionName = toolCall.function.name;
        let functionArgs;
        try {
          functionArgs = JSON.parse(toolCall.function.arguments);
        } catch {
          functionArgs = {};
        }

        // Injetar user_id se não fornecido
        if (!functionArgs.user_id && !isGuest) {
          functionArgs.user_id = user.id;
        }

        const result = await executeFunction(functionName, functionArgs, supabase, conversation.id);

        return {
          tool_call_id: toolCall.id,
          role: 'tool' as const,
          name: functionName,
          content: result
        };
      });

      const results = await Promise.all(promises);
      toolResults.push(...results);

      // Acumular no histórico
      messageHistory.push(choice.message);
      messageHistory.push(...toolResults);

      const followUpPayload = {
        model: 'google/gemini-2.5-flash',
        messages: messageHistory,
        tools: AVAILABLE_TOOLS,
        temperature: 0.5,
        max_tokens: 2000
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
        const errText = await aiResponse.text();
        console.error(`AI Error iteration ${iterations}:`, aiResponse.status, errText);
        break;
      }

      aiData = await aiResponse.json();
      choice = aiData.choices[0];
    }

    // Resposta final
    const assistantMessage = choice.message?.content || 'Desculpe, tive um probleminha técnico. Pode tentar de novo? 😊';

    // Salvar resposta
    await supabase.from('support_messages').insert({
      conversation_id: conversation.id,
      role: 'assistant',
      content: assistantMessage
    });

    await supabase.from('support_conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversation.id);

    return new Response(JSON.stringify({
      conversationId: conversation.id,
      response: assistantMessage
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      response: 'Ops, tive um probleminha. Tenta de novo em alguns segundos! 😊'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
