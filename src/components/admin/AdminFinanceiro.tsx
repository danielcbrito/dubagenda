import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Download, Calendar as CalendarIcon, DollarSign, TrendingUp, Wallet, RefreshCw, FileText, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface LocalRevenue {
  receitaMes: number;
  receitaApp: number;
  receitaBarbearia: number;
  receitaCredito: number;
  receitaPlano: number;
}

interface DailyChartData {
  date: string;
  label: string;
  receita: number;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

export function AdminFinanceiro() {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [loading, setLoading] = useState(true);
  const [localRevenue, setLocalRevenue] = useState<LocalRevenue>({
    receitaMes: 0,
    receitaApp: 0,
    receitaBarbearia: 0,
    receitaCredito: 0,
    receitaPlano: 0,
  });
  const [dailyChartData, setDailyChartData] = useState<DailyChartData[]>([]);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [paymentMethodsData, setPaymentMethodsData] = useState<{ method: string; value: number }[]>([]);

  useEffect(() => {
    loadLocalRevenue();
  }, [dateRange]);

  const loadLocalRevenue = async () => {
    setLoading(true);
    try {
      const fromDate = format(dateRange.from, "yyyy-MM-dd");
      const toDate = format(dateRange.to, "yyyy-MM-dd");

      // Buscar agendamentos completados no período
      const { data: appointments } = await supabase
        .from("agendamentos")
        .select("id, preco, payment_method, data, servico_id")
        .gte("data", fromDate)
        .lte("data", toDate)
        .eq("status", "completed");

      // Buscar serviços para pegar preço real
      const { data: servicos } = await supabase
        .from("servicos")
        .select("id, preco");

      const servicoPrecoMap = new Map((servicos || []).map(s => [s.id, s.preco]));

      // Buscar pagamentos de assinaturas (planos) no período
      const { data: subscriptionPayments } = await supabase
        .from("pagamentos")
        .select("valor, data_pagamento, created_at")
        .not("assinatura_id", "is", null)
        .eq("status", "paid")
        .gte("created_at", `${fromDate}T00:00:00`)
        .lte("created_at", `${toDate}T23:59:59`);

      // Buscar créditos usados no período
      const { data: usedCredits } = await supabase
        .from("creditos")
        .select("valor, agendamento_usado_id")
        .eq("usado", true)
        .gte("created_at", `${fromDate}T00:00:00`)
        .lte("created_at", `${toDate}T23:59:59`);

      let receitaApp = 0;
      let receitaBarbearia = 0;

      const receitaCredito = (usedCredits || []).reduce((sum, c) => sum + (c.valor || 0), 0);

      // Dados para gráfico de pizza por método
      const methodTotals: Record<string, number> = {};

      (appointments || []).forEach((apt) => {
        const preco = apt.preco || 0;
        const method = apt.payment_method || 'barbearia';

        switch (method) {
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
            break;
          case 'plano':
            break;
          default:
            if (preco > 0) receitaBarbearia += preco;
        }

        // Agregar por método para gráfico
        const label = method === 'cash' || method === 'barbearia' ? 'Barbearia' :
                      method === 'pix' ? 'PIX' :
                      method === 'card' ? 'Cartão' :
                      method === 'plano' ? 'Plano' :
                      method === 'credit' || method === 'credito' ? 'Crédito' :
                      method === 'resgate' ? 'Resgate' : 'Outro';
        methodTotals[label] = (methodTotals[label] || 0) + preco;
      });

      const receitaPlano = (subscriptionPayments || []).reduce((sum, p) => sum + (p.valor || 0), 0);
      const receitaMes = receitaApp + receitaBarbearia + receitaCredito + receitaPlano;

      // Dados diários para gráfico
      const chartData: DailyChartData[] = [];
      const daysInRange = Math.min(14, Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      
      for (let i = daysInRange - 1; i >= 0; i--) {
        const date = new Date(dateRange.to);
        date.setDate(date.getDate() - i);
        const dateStr = format(date, 'yyyy-MM-dd');
        
        const dayAppointments = (appointments || []).filter(apt => apt.data === dateStr);
        let dayRevenue = 0;
        
        dayAppointments.forEach(apt => {
          const preco = apt.preco || 0;
          const precoServico = servicoPrecoMap.get(apt.servico_id) || preco;
          
          if (apt.payment_method === 'credit' || apt.payment_method === 'credito') {
            const creditUsed = (usedCredits || []).find(c => c.agendamento_usado_id === apt.id);
            dayRevenue += creditUsed?.valor || precoServico;
          } else if (apt.payment_method === 'plano') {
            // Receita de planos vem dos pagamentos de assinatura
          } else {
            dayRevenue += preco;
          }
        });
        
        const daySubscriptionPayments = (subscriptionPayments || []).filter(p => {
          const paymentDate = p.data_pagamento || p.created_at;
          return paymentDate && paymentDate.startsWith(dateStr);
        });
        dayRevenue += daySubscriptionPayments.reduce((sum, p) => sum + (p.valor || 0), 0);
        
        chartData.push({
          date: dateStr,
          label: format(date, 'dd/MM'),
          receita: dayRevenue,
        });
      }

      setLocalRevenue({ receitaMes, receitaApp, receitaBarbearia, receitaCredito, receitaPlano });
      setDailyChartData(chartData);
      setPaymentMethodsData(
        Object.entries(methodTotals)
          .filter(([, v]) => v > 0)
          .map(([method, value]) => ({ method, value }))
      );
    } catch (error) {
      console.error("Error loading revenue:", error);
      toast.error("Erro ao carregar dados financeiros");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateMonthlyReport = async () => {
    setGeneratingReport(true);
    try {
      const mes = dateRange.from.getMonth() + 1;
      const ano = dateRange.from.getFullYear();

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      toast.loading('Gerando relatório mensal com IA...', { id: 'report' });

      const response = await supabase.functions.invoke('generate-monthly-report', {
        body: { mes, ano },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.error) throw response.error;

      toast.success(`Relatório de ${format(dateRange.from, 'MMMM/yyyy', { locale: ptBR })} gerado com sucesso!`, { id: 'report' });
      
      const report = response.data.report;
      navigate(`/admin/relatorios-mensais?id=${report.id}`);
    } catch (error: any) {
      console.error('Error generating report:', error);
      toast.error(error.message || 'Erro ao gerar relatório', { id: 'report' });
    } finally {
      setGeneratingReport(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Carregando dados financeiros...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Controle Financeiro</h1>
          <p className="text-sm text-muted-foreground">Visão completa das receitas</p>
        </div>
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <CalendarIcon className="w-4 h-4 mr-2" />
                {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} - {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    setDateRange({ from: range.from, to: range.to });
                  }
                }}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" onClick={() => loadLocalRevenue()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button variant="outline" onClick={() => navigate('/admin/relatorios-mensais')}>
            <FileText className="w-4 h-4 mr-2" />
            Relatórios
          </Button>
          <Button onClick={handleGenerateMonthlyReport} disabled={generatingReport}>
            {generatingReport ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            Exportar Relatório
          </Button>
        </div>
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita do Mês</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              R$ {localRevenue.receitaMes.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total de todos os canais</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita de Planos</CardTitle>
            <Wallet className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">
              R$ {localRevenue.receitaPlano.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Assinaturas pagas via Stripe</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Barbearia</CardTitle>
            <DollarSign className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">
              R$ {localRevenue.receitaBarbearia.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Pago presencialmente</p>
          </CardContent>
        </Card>
      </div>

      {/* Cards de origem da receita */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card border-green-500/20">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Pago no App</p>
            <p className="text-xl font-bold text-green-500">R$ {localRevenue.receitaApp.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-amber-500/20">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Pago na Barbearia</p>
            <p className="text-xl font-bold text-amber-500">R$ {localRevenue.receitaBarbearia.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-purple-500/20">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Crédito App</p>
            <p className="text-xl font-bold text-purple-500">R$ {localRevenue.receitaCredito.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-blue-500/20">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Planos</p>
            <p className="text-xl font-bold text-blue-500">R$ {localRevenue.receitaPlano.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de evolução diária */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Evolução de Receita
          </CardTitle>
          <p className="text-sm text-muted-foreground">Receita diária do período selecionado</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis 
                dataKey="label" 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={12}
                tickLine={false}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={12}
                tickLine={false}
                tickFormatter={(value) => `R$${value}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Receita']}
              />
              <Line 
                type="monotone" 
                dataKey="receita" 
                stroke="hsl(var(--primary))" 
                strokeWidth={3}
                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráfico por método de pagamento */}
      <Tabs defaultValue="methods" className="space-y-4">
        <TabsList>
          <TabsTrigger value="methods">Por Forma de Pagamento</TabsTrigger>
        </TabsList>

        <TabsContent value="methods" className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Receitas por Forma de Pagamento</CardTitle>
            </CardHeader>
            <CardContent>
              {paymentMethodsData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={paymentMethodsData}
                      dataKey="value"
                      nameKey="method"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(entry) => `${entry.method}: R$ ${entry.value.toFixed(2)}`}
                    >
                      {paymentMethodsData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum dado para o período selecionado
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
