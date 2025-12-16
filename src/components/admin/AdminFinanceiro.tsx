import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Download, Calendar as CalendarIcon, DollarSign, TrendingUp, TrendingDown, Wallet, Upload, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

interface AsaasFinancialData {
  stats: {
    balance: {
      balance: number;
      futureBalance: number;
      pendingBalance: number;
    };
    payments: {
      totalReceived: number;
      totalCreated: number;
      totalPaid: number;
      totalOverdue: number;
      totalRefunded: number;
    };
    fees: {
      totalFees: number;
      pixFees: number;
      creditCardFees: number;
      boletoFees: number;
    };
  };
  paymentsByMethod: Record<string, number>;
  transactions: Array<{
    id: string;
    date: string;
    description: string;
    value: number;
    netValue: number;
    fee: number;
    status: string;
    billingType: string;
  }>;
  timestamp: string;
}

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
  taxas: number;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];
const CACHE_KEY = 'asaas_financial_cache';
const CACHE_DURATION = 90000; // 90 seconds

export function AdminFinanceiro() {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AsaasFinancialData | null>(null);
  const [localRevenue, setLocalRevenue] = useState<LocalRevenue>({
    receitaMes: 0,
    receitaApp: 0,
    receitaBarbearia: 0,
    receitaCredito: 0,
    receitaPlano: 0,
  });
  const [dailyChartData, setDailyChartData] = useState<DailyChartData[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);

  useEffect(() => {
    loadFinancialData();
    loadLocalRevenue();
  }, [dateRange]);

  const loadLocalRevenue = async () => {
    try {
      const fromDate = format(dateRange.from, "yyyy-MM-dd");
      const toDate = format(dateRange.to, "yyyy-MM-dd");

      // Buscar agendamentos completados no período
      const { data: appointments } = await supabase
        .from("agendamentos")
        .select("preco, payment_method, data")
        .gte("data", fromDate)
        .lte("data", toDate)
        .eq("status", "completed");

      let receitaApp = 0;
      let receitaBarbearia = 0;
      let receitaCredito = 0;
      let receitaPlano = 0;

      (appointments || []).forEach((apt) => {
        const preco = apt.preco || 0;
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
            receitaCredito += preco;
            break;
          case 'plano':
            receitaPlano += preco;
            break;
          default:
            receitaBarbearia += preco;
        }
      });

      const receitaMes = receitaApp + receitaBarbearia + receitaCredito + receitaPlano;

      // Carregar dados diários para o gráfico de linhas
      const chartData: DailyChartData[] = [];
      const daysInRange = Math.min(14, Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      
      for (let i = daysInRange - 1; i >= 0; i--) {
        const date = new Date(dateRange.to);
        date.setDate(date.getDate() - i);
        const dateStr = format(date, 'yyyy-MM-dd');
        
        const dayAppointments = (appointments || []).filter(apt => apt.data === dateStr);
        const dayRevenue = dayAppointments.reduce((sum, apt) => sum + (apt.preco || 0), 0);
        
        chartData.push({
          date: dateStr,
          label: format(date, 'dd/MM'),
          receita: dayRevenue,
          taxas: 0, // Será preenchido com dados do Asaas
        });
      }

      setLocalRevenue({
        receitaMes,
        receitaApp,
        receitaBarbearia,
        receitaCredito,
        receitaPlano,
      });
      setDailyChartData(chartData);
    } catch (error) {
      console.error("Error loading local revenue:", error);
    }
  };

  const getCachedData = (): AsaasFinancialData | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;
      
      const { data, timestamp } = JSON.parse(cached);
      const now = Date.now();
      
      if (now - timestamp < CACHE_DURATION) {
        console.log('Using cached Asaas data');
        return data;
      }
      
      localStorage.removeItem(CACHE_KEY);
      return null;
    } catch (error) {
      console.error('Error reading cache:', error);
      return null;
    }
  };

  const setCachedData = (data: AsaasFinancialData) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        data,
        timestamp: Date.now(),
      }));
    } catch (error) {
      console.error('Error setting cache:', error);
    }
  };

  const loadFinancialData = async (forceRefresh = false) => {
    setLoading(true);
    try {
      if (!forceRefresh) {
        const cached = getCachedData();
        if (cached) {
          setData(cached);
          setLoading(false);
          return;
        }
      }

      const fromDate = format(dateRange.from, "yyyy-MM-dd");
      const toDate = format(dateRange.to, "yyyy-MM-dd");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await supabase.functions.invoke('get-asaas-financial-data', {
        body: { dateFrom: fromDate, dateTo: toDate },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw response.error;
      }

      setData(response.data);
      setCachedData(response.data);
      toast.success('Dados financeiros atualizados com sucesso');
    } catch (error: any) {
      console.error("Error loading financial data:", error);
      toast.error("Erro ao carregar dados financeiros do Asaas");
    } finally {
      setLoading(false);
    }
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      
      const parsed = lines.slice(1).filter(line => line.trim()).map(line => {
        const values = line.split(',');
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index]?.trim() || '';
        });
        return row;
      });
      
      setCsvData(parsed);
      toast.success(`${parsed.length} transações importadas do CSV`);
    };
    
    reader.readAsText(file);
  };

  const handleExportCSV = () => {
    if (!data) return;

    const transactions = data.transactions.map(t => ({
      Data: format(new Date(t.date), 'dd/MM/yyyy'),
      Descrição: t.description,
      'Valor Bruto': t.value.toFixed(2),
      Taxa: t.fee.toFixed(2),
      'Valor Líquido': t.netValue.toFixed(2),
      Status: t.status,
      'Forma Pagamento': t.billingType,
    }));

    const csv = [
      Object.keys(transactions[0]).join(','),
      ...transactions.map(row => Object.values(row).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financeiro_asaas_${format(dateRange.from, "yyyy-MM-dd")}_${format(dateRange.to, "yyyy-MM-dd")}.csv`;
    a.click();
    toast.success("Relatório exportado com sucesso");
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Carregando dados financeiros do Asaas...</p>
        </div>
      </div>
    );
  }

  const netProfit = data.stats.payments.totalReceived - data.stats.fees.totalFees;
  const paymentMethodsData = Object.entries(data.paymentsByMethod).map(([method, value]) => ({
    method,
    value,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Controle Financeiro</h1>
          <p className="text-sm text-muted-foreground">Visão completa das receitas e taxas</p>
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
          <Button variant="outline" onClick={() => { loadFinancialData(true); loadLocalRevenue(); }}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Cards principais - Resumo Financeiro */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita do Mês</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              R$ {localRevenue.receitaMes.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total de todos os canais
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Disponível</CardTitle>
            <Wallet className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">
              R$ {data.stats.balance.balance.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Disponível para saque
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxas Asaas</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              R$ {data.stats.fees.totalFees.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              PIX: R$ {data.stats.fees.pixFees.toFixed(2)} | Cartão: R$ {data.stats.fees.creditCardFees.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lucro Líquido</CardTitle>
            <DollarSign className="h-4 w-4 text-gold" />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", netProfit >= 0 ? "text-gold" : "text-red-500")}>
              R$ {netProfit.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Receita App - Taxas
            </p>
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

      {/* Gráfico de linhas - Evolução diária */}
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

      <Tabs defaultValue="transactions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="transactions">Transações Asaas</TabsTrigger>
          <TabsTrigger value="methods">Por Forma de Pagamento</TabsTrigger>
          <TabsTrigger value="import">Importar CSV</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Histórico de Transações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left p-3 font-medium">Data</th>
                      <th className="text-left p-3 font-medium">Descrição</th>
                      <th className="text-right p-3 font-medium">Valor</th>
                      <th className="text-right p-3 font-medium">Taxa</th>
                      <th className="text-right p-3 font-medium">Líquido</th>
                      <th className="text-left p-3 font-medium">Método</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.transactions.map((t) => (
                      <tr key={t.id} className="border-b border-border/30 hover:bg-secondary/30 transition-colors">
                        <td className="p-3">{format(new Date(t.date), 'dd/MM/yyyy')}</td>
                        <td className="p-3">{t.description}</td>
                        <td className="text-right p-3 font-medium">R$ {t.value.toFixed(2)}</td>
                        <td className="text-right p-3 text-red-500">-R$ {t.fee.toFixed(2)}</td>
                        <td className="text-right p-3 text-green-500 font-medium">R$ {t.netValue.toFixed(2)}</td>
                        <td className="p-3">
                          <span className="px-2 py-1 rounded-full text-xs bg-secondary">
                            {t.billingType}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.transactions.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma transação no período
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="methods" className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Receitas por Forma de Pagamento (Asaas)</CardTitle>
            </CardHeader>
            <CardContent>
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
                    {paymentMethodsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Importar Extrato CSV do Asaas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvUpload}
                  className="max-w-md"
                />
                <Button variant="outline">
                  <Upload className="w-4 h-4 mr-2" />
                  Importar CSV
                </Button>
              </div>
              
              {csvData.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-border/30 rounded-lg">
                    <thead>
                      <tr className="bg-secondary/50">
                        {Object.keys(csvData[0]).map((header) => (
                          <th key={header} className="text-left p-2 border-b border-border/30">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.slice(0, 50).map((row, index) => (
                        <tr key={index} className="border-b border-border/20">
                          {Object.values(row).map((value: any, i) => (
                            <td key={i} className="p-2">
                              {value}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {csvData.length > 50 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Mostrando 50 de {csvData.length} registros
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="text-xs text-muted-foreground text-right">
        Última atualização Asaas: {format(new Date(data.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
      </div>
    </div>
  );
}
