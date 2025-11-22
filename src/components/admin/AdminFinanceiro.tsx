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
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);

  useEffect(() => {
    loadFinancialData();
  }, [dateRange]);

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Financeiro - Sincronizado com Asaas</h1>
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
          <Button variant="outline" onClick={() => loadFinancialData(true)}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Disponível</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">R$ {data.stats.balance.balance.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Futuro: R$ {data.stats.balance.futureBalance.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Bruta</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {data.stats.payments.totalPaid.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.transactions.length} transações
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxas Asaas</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">R$ {data.stats.fees.totalFees.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              PIX: R$ {data.stats.fees.pixFees.toFixed(2)} | Cartão: R$ {data.stats.fees.creditCardFees.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lucro Líquido</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", netProfit >= 0 ? "text-green-600" : "text-red-600")}>
              R$ {netProfit.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Receita - Taxas
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cobranças Criadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {data.stats.payments.totalCreated.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cobranças Atrasadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">R$ {data.stats.payments.totalOverdue.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estornos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">R$ {data.stats.payments.totalRefunded.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="methods">Formas de Pagamento</TabsTrigger>
          <TabsTrigger value="transactions">Transações</TabsTrigger>
          <TabsTrigger value="import">Importar CSV</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Evolução de Receitas vs Taxas</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={[
                  { name: 'Receita Bruta', value: data.stats.payments.totalPaid },
                  { name: 'Taxas', value: data.stats.fees.totalFees },
                  { name: 'Lucro Líquido', value: netProfit },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="methods" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Receitas por Forma de Pagamento</CardTitle>
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
                    outerRadius={80}
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

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Transações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Data</th>
                      <th className="text-left p-2">Descrição</th>
                      <th className="text-right p-2">Valor Bruto</th>
                      <th className="text-right p-2">Taxa</th>
                      <th className="text-right p-2">Líquido</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Método</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.transactions.map((t) => (
                      <tr key={t.id} className="border-b">
                        <td className="p-2">{format(new Date(t.date), 'dd/MM/yyyy')}</td>
                        <td className="p-2">{t.description}</td>
                        <td className="text-right p-2">R$ {t.value.toFixed(2)}</td>
                        <td className="text-right p-2 text-red-600">R$ {t.fee.toFixed(2)}</td>
                        <td className="text-right p-2 text-green-600">R$ {t.netValue.toFixed(2)}</td>
                        <td className="p-2">{t.status}</td>
                        <td className="p-2">{t.billingType}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="space-y-4">
          <Card>
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
                  <table className="w-full text-sm border">
                    <thead>
                      <tr className="bg-muted">
                        {Object.keys(csvData[0]).map((header) => (
                          <th key={header} className="text-left p-2 border">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.slice(0, 50).map((row, index) => (
                        <tr key={index} className="border-b">
                          {Object.values(row).map((value: any, i) => (
                            <td key={i} className="p-2 border">
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
        Última atualização: {format(new Date(data.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
      </div>
    </div>
  );
}
