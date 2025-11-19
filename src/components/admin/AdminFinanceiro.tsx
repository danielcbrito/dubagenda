import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Download, Calendar as CalendarIcon, CreditCard, DollarSign, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

interface FinancialData {
  totalRevenue: number;
  revenueByMethod: { method: string; total: number }[];
  totalExpenses: number;
  expensesByCategory: { category: string; total: number }[];
  totalCommissions: number;
  unpaidCommissions: number;
  serviceCosts: { service: string; cost: number; revenue: number; profit: number }[];
  barberCommissions: { name: string; total: number; paid: number; pending: number }[];
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

export function AdminFinanceiro() {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FinancialData>({
    totalRevenue: 0,
    revenueByMethod: [],
    totalExpenses: 0,
    expensesByCategory: [],
    totalCommissions: 0,
    unpaidCommissions: 0,
    serviceCosts: [],
    barberCommissions: [],
  });

  useEffect(() => {
    loadFinancialData();
  }, [dateRange]);

  const loadFinancialData = async () => {
    setLoading(true);
    try {
      const fromDate = format(dateRange.from, "yyyy-MM-dd");
      const toDate = format(dateRange.to, "yyyy-MM-dd");

      // Receitas por método de pagamento
      const { data: payments, error: paymentsError } = await supabase
        .from("pagamentos")
        .select("metodo, valor")
        .eq("status", "paid")
        .gte("data_pagamento", fromDate)
        .lte("data_pagamento", toDate);

      if (paymentsError) throw paymentsError;

      const revenueByMethod = payments?.reduce((acc: any[], curr) => {
        const existing = acc.find(item => item.method === curr.metodo);
        if (existing) {
          existing.total += Number(curr.valor);
        } else {
          acc.push({ method: curr.metodo, total: Number(curr.valor) });
        }
        return acc;
      }, []) || [];

      const totalRevenue = revenueByMethod.reduce((sum, item) => sum + item.total, 0);

      // Despesas por categoria
      const { data: expenses, error: expensesError } = await supabase
        .from("financial_entries")
        .select("categoria, valor")
        .eq("tipo", "expense")
        .gte("data", fromDate)
        .lte("data", toDate);

      if (expensesError) throw expensesError;

      const expensesByCategory = expenses?.reduce((acc: any[], curr) => {
        const existing = acc.find(item => item.category === curr.categoria);
        if (existing) {
          existing.total += Number(curr.valor);
        } else {
          acc.push({ category: curr.categoria, total: Number(curr.valor) });
        }
        return acc;
      }, []) || [];

      const totalExpenses = expensesByCategory.reduce((sum, item) => sum + item.total, 0);

      // Comissões
      const { data: commissions, error: commissionsError } = await supabase
        .from("comissoes")
        .select("valor, pago, barbeiro_id, barbeiros(apelido)")
        .gte("created_at", fromDate)
        .lte("created_at", toDate);

      if (commissionsError) throw commissionsError;

      const totalCommissions = commissions?.reduce((sum, c) => sum + Number(c.valor), 0) || 0;
      const unpaidCommissions = commissions?.filter(c => !c.pago).reduce((sum, c) => sum + Number(c.valor), 0) || 0;

      const barberCommissions = commissions?.reduce((acc: any[], curr) => {
        const name = (curr.barbeiros as any)?.apelido || "Sem barbeiro";
        const existing = acc.find(item => item.name === name);
        const valor = Number(curr.valor);
        if (existing) {
          existing.total += valor;
          if (curr.pago) {
            existing.paid += valor;
          } else {
            existing.pending += valor;
          }
        } else {
          acc.push({
            name,
            total: valor,
            paid: curr.pago ? valor : 0,
            pending: !curr.pago ? valor : 0,
          });
        }
        return acc;
      }, []) || [];

      // Custos por serviço
      const { data: appointments, error: appointmentsError } = await supabase
        .from("agendamentos")
        .select("servico_id, preco, servicos(nome, custo_produtos, custo_mao_obra)")
        .eq("status", "completed")
        .gte("data", fromDate)
        .lte("data", toDate);

      if (appointmentsError) throw appointmentsError;

      const serviceCosts = appointments?.reduce((acc: any[], curr) => {
        const serviceName = (curr.servicos as any)?.nome || "Serviço desconhecido";
        const cost = Number((curr.servicos as any)?.custo_produtos || 0) + Number((curr.servicos as any)?.custo_mao_obra || 0);
        const revenue = Number(curr.preco);
        const profit = revenue - cost;

        const existing = acc.find(item => item.service === serviceName);
        if (existing) {
          existing.cost += cost;
          existing.revenue += revenue;
          existing.profit += profit;
        } else {
          acc.push({ service: serviceName, cost, revenue, profit });
        }
        return acc;
      }, []) || [];

      setData({
        totalRevenue,
        revenueByMethod,
        totalExpenses,
        expensesByCategory,
        totalCommissions,
        unpaidCommissions,
        serviceCosts,
        barberCommissions,
      });
    } catch (error: any) {
      console.error("Error loading financial data:", error);
      toast.error("Erro ao carregar dados financeiros");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const csv = [
      ["Tipo", "Descrição", "Valor"],
      ["Receita Total", "", data.totalRevenue.toFixed(2)],
      ...data.revenueByMethod.map(r => ["Receita", r.method, r.total.toFixed(2)]),
      ["Despesa Total", "", data.totalExpenses.toFixed(2)],
      ...data.expensesByCategory.map(e => ["Despesa", e.category, e.total.toFixed(2)]),
      ["Comissões Total", "", data.totalCommissions.toFixed(2)],
      ["Comissões Pendentes", "", data.unpaidCommissions.toFixed(2)],
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financeiro_${format(dateRange.from, "yyyy-MM-dd")}_${format(dateRange.to, "yyyy-MM-dd")}.csv`;
    a.click();
    toast.success("Relatório exportado com sucesso");
  };

  const netProfit = data.totalRevenue - data.totalExpenses - data.totalCommissions;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Financeiro</h1>
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
          <Button onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">Carregando...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">R$ {data.totalRevenue.toFixed(2)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Despesas</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">R$ {data.totalExpenses.toFixed(2)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Comissões</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">R$ {data.totalCommissions.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Pendentes: R$ {data.unpaidCommissions.toFixed(2)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Lucro Líquido</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={cn("text-2xl font-bold", netProfit >= 0 ? "text-green-600" : "text-red-600")}>
                  R$ {netProfit.toFixed(2)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="revenue" className="space-y-4">
            <TabsList>
              <TabsTrigger value="revenue">Receitas</TabsTrigger>
              <TabsTrigger value="expenses">Despesas</TabsTrigger>
              <TabsTrigger value="commissions">Comissões</TabsTrigger>
              <TabsTrigger value="services">Serviços</TabsTrigger>
            </TabsList>

            <TabsContent value="revenue" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Receitas por Método de Pagamento</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={data.revenueByMethod}
                        dataKey="total"
                        nameKey="method"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={(entry) => `${entry.method}: R$ ${entry.total.toFixed(2)}`}
                      >
                        {data.revenueByMethod.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="expenses" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Despesas por Categoria</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.expensesByCategory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="total" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="commissions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Comissões por Barbeiro</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.barberCommissions}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="paid" name="Pagas" fill="hsl(var(--primary))" />
                      <Bar dataKey="pending" name="Pendentes" fill="hsl(var(--secondary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="services" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Lucratividade por Serviço</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.serviceCosts}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="service" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="revenue" name="Receita" fill="hsl(var(--primary))" />
                      <Bar dataKey="cost" name="Custo" fill="hsl(var(--secondary))" />
                      <Bar dataKey="profit" name="Lucro" fill="hsl(var(--accent))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
