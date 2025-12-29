import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MonthlyReportData {
  mes: number;
  ano: number;
  receita_total: number;
  receita_app: number;
  receita_barbearia: number;
  receita_credito: number;
  receita_plano: number;
  taxas_asaas: number;
  lucro_liquido: number;
  total_agendamentos: number;
  agendamentos_completados: number;
  agendamentos_cancelados: number;
  agendamentos_no_show: number;
  variacao_receita_percentual: number;
  variacao_agendamentos_percentual: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('LOVABLE_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse body
    const body = await req.json();
    const { mes: inputMes, ano: inputAno, auto_generate } = body;

    // Se for geração automática (chamada pelo cron), não precisa de autenticação
    // O cron chama no primeiro dia do mês para gerar o relatório do mês anterior
    if (!auto_generate) {
      // Verificar autenticação para chamadas manuais
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        throw new Error('Unauthorized');
      }

      const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!;
      const authClient = createClient(supabaseUrl, supabaseAnon, {
        global: { headers: { Authorization: authHeader } }
      });
      
      const { data: { user }, error: authError } = await authClient.auth.getUser();
      if (authError || !user) {
        throw new Error('Unauthorized');
      }

      // Verificar se é admin
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin');

      if (!roles || roles.length === 0) {
        throw new Error('Forbidden: Admin access required');
      }
    }

    // Se for auto_generate, calcular mês anterior
    let mes: number;
    let ano: number;

    if (auto_generate) {
      const now = new Date();
      // Mês anterior
      const prevMonth = now.getMonth(); // 0-11, mas se estivermos em Janeiro, isso será 0
      if (prevMonth === 0) {
        mes = 12;
        ano = now.getFullYear() - 1;
      } else {
        mes = prevMonth; // getMonth retorna 0-11, então se estamos em fevereiro (1), queremos janeiro (1)
        ano = now.getFullYear();
      }
      console.log(`[AUTO] Gerando relatório automático do mês anterior: ${mes}/${ano}`);
    } else {
      mes = inputMes;
      ano = inputAno;
    }
    
    // Calcular datas do período
    const startDate = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const endDate = new Date(ano, mes, 0).toISOString().split('T')[0]; // Último dia do mês

    console.log(`Gerando relatório para ${mes}/${ano}: ${startDate} a ${endDate}`);

    // Buscar TODOS os agendamentos do período (sem filtro de status)
    const { data: appointments } = await supabase
      .from('agendamentos')
      .select('id, preco, payment_method, data, status, servico_id, is_free')
      .gte('data', startDate)
      .lte('data', endDate);

    // Buscar serviços
    const { data: servicos } = await supabase
      .from('servicos')
      .select('id, preco, nome');

    const servicoMap = new Map((servicos || []).map(s => [s.id, s]));

    // Buscar créditos usados no período
    const { data: usedCredits } = await supabase
      .from('creditos')
      .select('valor, agendamento_usado_id')
      .eq('usado', true)
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`);

    // Buscar pagamentos de planos (assinaturas) - buscar por data_pagamento OU created_at
    const { data: planPayments } = await supabase
      .from('pagamentos')
      .select('valor, data_pagamento, created_at, assinatura_id')
      .not('assinatura_id', 'is', null)
      .eq('status', 'paid');

    // Filtrar pagamentos de planos pelo período corretamente
    const filteredPlanPayments = (planPayments || []).filter(p => {
      const paymentDate = p.data_pagamento || p.created_at?.split('T')[0];
      if (!paymentDate) return false;
      return paymentDate >= startDate && paymentDate <= endDate;
    });

    console.log(`Pagamentos de planos encontrados no período: ${filteredPlanPayments.length}`);

    // Calcular métricas - contando TUDO
    let receitaApp = 0;
    let receitaBarbearia = 0;
    let receitaCredito = 0;
    let totalAgendamentos = appointments?.length || 0;
    let completados = 0;
    let confirmados = 0;
    let pendentes = 0;
    let cancelados = 0;
    let noShow = 0;
    let cortesGratis = 0;

    const creditoMap = new Map((usedCredits || []).map(c => [c.agendamento_usado_id, c.valor]));

    (appointments || []).forEach(apt => {
      const preco = apt.preco || 0;
      const precoServico = servicoMap.get(apt.servico_id)?.preco || preco;

      // Contar por status
      switch (apt.status) {
        case 'completed':
          completados++;
          break;
        case 'confirmed':
          confirmados++;
          break;
        case 'pending':
          pendentes++;
          break;
        case 'cancelled_by_user':
        case 'cancelled_by_admin':
          cancelados++;
          break;
        case 'no_show':
          noShow++;
          break;
      }

      // Contar cortes grátis
      if (apt.is_free) {
        cortesGratis++;
      }

      // Calcular receita apenas para agendamentos não cancelados e não no-show
      const statusValido = apt.status === 'completed' || apt.status === 'confirmed' || apt.status === 'pending';
      if (statusValido && !apt.is_free) {
        switch (apt.payment_method) {
          case 'pix':
          case 'card':
            receitaApp += preco;
            break;
          case 'barbearia':
          case 'cash':
            receitaBarbearia += preco;
            break;
          case 'credit':
          case 'credito':
            const creditUsed = creditoMap.get(apt.id);
            receitaCredito += creditUsed || precoServico;
            break;
          case 'plano':
            // Planos são contabilizados separadamente via pagamentos
            break;
          default:
            if (preco > 0) {
              receitaBarbearia += preco;
            }
        }
      }
    });

    // Total de cortes feitos = completados + confirmados (não cancelados)
    const cortesFeitosMes = completados + confirmados;

    const receitaPlano = (planPayments || []).reduce((sum, p) => sum + (p.valor || 0), 0);
    const receitaTotal = receitaApp + receitaBarbearia + receitaCredito + receitaPlano;

    // Buscar mês anterior para comparação
    const mesAnterior = mes === 1 ? 12 : mes - 1;
    const anoAnterior = mes === 1 ? ano - 1 : ano;

    const { data: relatorioAnterior } = await supabase
      .from('relatorios_mensais')
      .select('receita_total, agendamentos_completados')
      .eq('mes', mesAnterior)
      .eq('ano', anoAnterior)
      .maybeSingle();

    const variacaoReceita = relatorioAnterior?.receita_total 
      ? ((receitaTotal - relatorioAnterior.receita_total) / relatorioAnterior.receita_total) * 100 
      : 0;
    const variacaoAgendamentos = relatorioAnterior?.agendamentos_completados 
      ? ((completados - relatorioAnterior.agendamentos_completados) / relatorioAnterior.agendamentos_completados) * 100 
      : 0;

    // Estimar taxas Asaas (aproximadamente 2.5% para PIX e 5% para cartão)
    const taxasEstimadas = receitaApp * 0.03; // Média de 3%
    const lucroLiquido = receitaTotal - taxasEstimadas;

    const reportData: MonthlyReportData = {
      mes,
      ano,
      receita_total: receitaTotal,
      receita_app: receitaApp,
      receita_barbearia: receitaBarbearia,
      receita_credito: receitaCredito,
      receita_plano: receitaPlano,
      taxas_asaas: taxasEstimadas,
      lucro_liquido: lucroLiquido,
      total_agendamentos: totalAgendamentos,
      agendamentos_completados: completados,
      agendamentos_cancelados: cancelados,
      agendamentos_no_show: noShow,
      variacao_receita_percentual: Number(variacaoReceita.toFixed(2)),
      variacao_agendamentos_percentual: Number(variacaoAgendamentos.toFixed(2)),
    };

    // Gerar resumo com IA (se disponível)
    let resumoIA = '';
    let insightsIA = null;

    if (openaiKey) {
      try {
        const prompt = `Você é um analista financeiro de uma barbearia. Analise os dados do mês ${mes}/${ano} e gere um resumo executivo profissional em português brasileiro.

Dados do mês:
- Total de Agendamentos no Mês: ${totalAgendamentos}
- Cortes Realizados (Confirmados + Concluídos): ${cortesFeitosMes}
- Cortes Concluídos: ${completados}
- Cortes Confirmados (aguardando): ${confirmados}
- Pendentes: ${pendentes}
- Cancelados: ${cancelados}
- No-shows: ${noShow}
- Cortes Grátis (Fidelidade): ${cortesGratis}
- Receita Total: R$ ${receitaTotal.toFixed(2)}
- Receita via App (PIX/Cartão): R$ ${receitaApp.toFixed(2)}
- Receita em Dinheiro (Barbearia): R$ ${receitaBarbearia.toFixed(2)}
- Créditos Utilizados: R$ ${receitaCredito.toFixed(2)}
- Receita de Planos/Assinaturas: R$ ${receitaPlano.toFixed(2)}
- Taxas de Gateway: R$ ${taxasEstimadas.toFixed(2)}
- Lucro Líquido: R$ ${lucroLiquido.toFixed(2)}
- Variação Receita vs Mês Anterior: ${variacaoReceita.toFixed(1)}%
- Variação Agendamentos vs Mês Anterior: ${variacaoAgendamentos.toFixed(1)}%

Gere um resumo executivo de 3-4 parágrafos destacando:
1. Visão geral do desempenho do mês com números exatos
2. Principais fontes de receita e tendências
3. Taxa de sucesso dos agendamentos
4. Recomendações para melhorar resultados`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 1000,
            temperature: 0.7,
          }),
        });

        if (response.ok) {
          const aiData = await response.json();
          resumoIA = aiData.choices?.[0]?.message?.content || '';
          
          // Gerar insights estruturados
          insightsIA = {
            taxaConversao: totalAgendamentos > 0 ? ((completados / totalAgendamentos) * 100).toFixed(1) : 0,
            ticketMedio: completados > 0 ? (receitaTotal / completados).toFixed(2) : 0,
            principalCanal: receitaApp > receitaBarbearia ? 'App' : 'Barbearia',
            tendencia: variacaoReceita > 0 ? 'crescimento' : variacaoReceita < 0 ? 'queda' : 'estável',
          };
        }
      } catch (aiError) {
        console.error('Error generating AI summary:', aiError);
        resumoIA = `Relatório mensal de ${mes}/${ano}: Receita total de R$ ${receitaTotal.toFixed(2)} com ${completados} atendimentos concluídos.`;
      }
    } else {
      resumoIA = `📊 **Relatório Financeiro - ${mes}/${ano}**\n\n` +
        `💰 **Receita Total:** R$ ${receitaTotal.toFixed(2)}\n` +
        `• App (PIX/Cartão): R$ ${receitaApp.toFixed(2)}\n` +
        `• Barbearia (Dinheiro): R$ ${receitaBarbearia.toFixed(2)}\n` +
        `• Créditos: R$ ${receitaCredito.toFixed(2)}\n` +
        `• Planos: R$ ${receitaPlano.toFixed(2)}\n\n` +
        `📅 **Agendamentos:** ${totalAgendamentos} total\n` +
        `• Concluídos: ${completados}\n` +
        `• Cancelados: ${cancelados}\n` +
        `• No-shows: ${noShow}\n\n` +
        `📈 **Variação:** ${variacaoReceita > 0 ? '+' : ''}${variacaoReceita.toFixed(1)}% vs mês anterior`;
      
      insightsIA = {
        taxaConversao: totalAgendamentos > 0 ? ((completados / totalAgendamentos) * 100).toFixed(1) : 0,
        ticketMedio: completados > 0 ? (receitaTotal / completados).toFixed(2) : 0,
        principalCanal: receitaApp > receitaBarbearia ? 'App' : 'Barbearia',
        tendencia: variacaoReceita > 0 ? 'crescimento' : variacaoReceita < 0 ? 'queda' : 'estável',
      };
    }

    // Salvar ou atualizar relatório
    const { data: existingReport } = await supabase
      .from('relatorios_mensais')
      .select('id')
      .eq('mes', mes)
      .eq('ano', ano)
      .maybeSingle();

    const reportRecord = {
      ...reportData,
      resumo_ia: resumoIA,
      insights_ia: insightsIA,
      gerado_automaticamente: false,
      updated_at: new Date().toISOString(),
    };

    let savedReport;
    if (existingReport) {
      const { data, error } = await supabase
        .from('relatorios_mensais')
        .update(reportRecord)
        .eq('id', existingReport.id)
        .select()
        .single();
      
      if (error) throw error;
      savedReport = data;
    } else {
      const { data, error } = await supabase
        .from('relatorios_mensais')
        .insert(reportRecord)
        .select()
        .single();
      
      if (error) throw error;
      savedReport = data;
    }

    console.log('Relatório salvo com sucesso:', savedReport.id);

    return new Response(JSON.stringify({
      success: true,
      report: savedReport,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error generating monthly report:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error'
    }), {
      status: error.message === 'Unauthorized' ? 401 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
