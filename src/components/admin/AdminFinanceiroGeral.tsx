import { useState, useEffect, useMemo } from "react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Users, 
  CreditCard, 
  Wallet, 
  Receipt, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Building2,
  UserCheck,
  FileText,
  ChevronRight,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  PiggyBank,
  Banknote,
  RefreshCcw,
  Download,
  CircleDollarSign,
  Minus,
  Eye,
  Printer,
  Sparkles,
  XCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";

interface BarberFinancialData {
  id: string;
  apelido: string;
  foto_url: string | null;
  totalRevenue: number;
  totalAppointments: number;
  completedAppointments: number;
  commissionPercent: number;
  commissionValue: number;
  paidCommission: number;
  pendingCommission: number;
  byPaymentMethod: {
    pix: number;
    card: number;
    cash: number;
  };
}

interface AsaasFinancialData {
  balance: number;
  pendingBalance: number;
  totalReceived: number;
  totalFees: number;
  netBalance: number;
}

interface MonthlyReport {
  id: string;
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
  resumo_ia: string | null;
  insights_ia: unknown;
  created_at: string;
}

const CHART_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];

const meses = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function AdminFinanceiroGeral() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  const [barbersData, setBarbersData] = useState<BarberFinancialData[]>([]);
  const [asaasData, setAsaasData] = useState<AsaasFinancialData | null>(null);
  const [loadingAsaas, setLoadingAsaas] = useState(false);
  const [monthlyRevenueData, setMonthlyRevenueData] = useState<any[]>([]);
  const [totalAppointmentsRevenue, setTotalAppointmentsRevenue] = useState(0);
  const [paymentMethodsData, setPaymentMethodsData] = useState<any[]>([]);
  const [savingCommissions, setSavingCommissions] = useState<Record<string, boolean>>({});
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [selectedReport, setSelectedReport] = useState<MonthlyReport | null>(null);

  useEffect(() => {
    loadAllFinancialData();
  }, [dateRange]);

  useEffect(() => {
    loadAsaasData();
    loadMonthlyRevenueData();
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoadingReports(true);
    try {
      const { data, error } = await supabase
        .from('relatorios_mensais')
        .select('*')
        .order('ano', { ascending: false })
        .order('mes', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error);
    } finally {
      setLoadingReports(false);
    }
  };

  const loadAllFinancialData = async () => {
    setLoading(true);
    try {
      const fromDate = format(dateRange.from, "yyyy-MM-dd");
      const toDate = format(dateRange.to, "yyyy-MM-dd");

      // Buscar todos os barbeiros ativos
      const { data: barbeiros } = await supabase
        .from("barbeiros")
        .select("id, apelido, foto_url, comissao_pct")
        .eq("ativo", true);

      if (!barbeiros) {
        setBarbersData([]);
        return;
      }

      // Buscar todos os agendamentos do período
      const { data: appointments } = await supabase
        .from("agendamentos")
        .select("id, preco, payment_method, barbeiro_id, status, is_free, servico_id")
        .gte("data", fromDate)
        .lte("data", toDate)
        .in("status", ["completed", "confirmed", "pending"]);

      // Buscar serviços para pegar preço real
      const { data: servicos } = await supabase
        .from("servicos")
        .select("id, preco");

      // Buscar comissões pagas no período
      const { data: paidCommissions } = await supabase
        .from("comissoes")
        .select("barbeiro_id, valor, pago")
        .eq("pago", true);

      const servicosMap = new Map((servicos || []).map(s => [s.id, s.preco]));
      const paidCommissionsMap = new Map<string, number>();
      
      (paidCommissions || []).forEach(c => {
        const current = paidCommissionsMap.get(c.barbeiro_id) || 0;
        paidCommissionsMap.set(c.barbeiro_id, current + c.valor);
      });

      // Calcular métricas por barbeiro
      const barbersFinancialData: BarberFinancialData[] = barbeiros.map(barber => {
        const barberAppointments = (appointments || []).filter(a => a.barbeiro_id === barber.id);
        const completedAppts = barberAppointments.filter(a => a.status === "completed");
        
        let totalRevenue = 0;
        const byPaymentMethod = { pix: 0, card: 0, cash: 0 };

        completedAppts.forEach(apt => {
          const preco = apt.is_free ? 0 : (apt.preco || servicosMap.get(apt.servico_id) || 0);
          totalRevenue += preco;
          
          const method = apt.payment_method as keyof typeof byPaymentMethod;
          if (method && byPaymentMethod[method] !== undefined) {
            byPaymentMethod[method] += preco;
          }
        });

        const commissionPercent = barber.comissao_pct || 30;
        const commissionValue = totalRevenue * (commissionPercent / 100);
        const paidCommission = paidCommissionsMap.get(barber.id) || 0;
        const pendingCommission = commissionValue - paidCommission;

        return {
          id: barber.id,
          apelido: barber.apelido,
          foto_url: barber.foto_url,
          totalRevenue,
          totalAppointments: barberAppointments.length,
          completedAppointments: completedAppts.length,
          commissionPercent,
          commissionValue,
          paidCommission,
          pendingCommission: Math.max(0, pendingCommission),
          byPaymentMethod
        };
      });

      setBarbersData(barbersFinancialData);

      // Calcular total de receita de agendamentos
      const total = barbersFinancialData.reduce((sum, b) => sum + b.totalRevenue, 0);
      setTotalAppointmentsRevenue(total);

      // Calcular dados por método de pagamento
      const methodTotals = barbersFinancialData.reduce((acc, b) => {
        acc.pix += b.byPaymentMethod.pix;
        acc.card += b.byPaymentMethod.card;
        acc.cash += b.byPaymentMethod.cash;
        return acc;
      }, { pix: 0, card: 0, cash: 0 });

      setPaymentMethodsData([
        { name: 'PIX', value: methodTotals.pix, color: '#10B981' },
        { name: 'Cartão', value: methodTotals.card, color: '#3B82F6' },
        { name: 'Dinheiro', value: methodTotals.cash, color: '#F59E0B' }
      ]);

    } catch (error) {
      console.error("Erro ao carregar dados financeiros:", error);
      toast.error("Erro ao carregar dados financeiros");
    } finally {
      setLoading(false);
    }
  };

  const loadAsaasData = async () => {
    setLoadingAsaas(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-asaas-financial-data", {
        body: {}
      });

      if (error) throw error;

      if (data) {
        setAsaasData({
          balance: data.balance || 0,
          pendingBalance: data.pendingBalance || 0,
          totalReceived: data.totalReceived || 0,
          totalFees: data.totalFees || 0,
          netBalance: data.netBalance || 0
        });
      }
    } catch (error) {
      console.error("Erro ao carregar dados do Asaas:", error);
    } finally {
      setLoadingAsaas(false);
    }
  };

  const loadMonthlyRevenueData = async () => {
    try {
      const monthsData = [];
      
      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(new Date(), i);
        const monthStart = format(startOfMonth(monthDate), "yyyy-MM-dd");
        const monthEnd = format(endOfMonth(monthDate), "yyyy-MM-dd");
        
        const { data: appointments } = await supabase
          .from("agendamentos")
          .select("preco, is_free, servico_id")
          .gte("data", monthStart)
          .lte("data", monthEnd)
          .eq("status", "completed");

        const { data: servicos } = await supabase
          .from("servicos")
          .select("id, preco");

        const servicosMap = new Map((servicos || []).map(s => [s.id, s.preco]));
        
        let totalRevenue = 0;
        (appointments || []).forEach(apt => {
          const preco = apt.is_free ? 0 : (apt.preco || servicosMap.get(apt.servico_id) || 0);
          totalRevenue += preco;
        });

        monthsData.push({
          month: format(monthDate, "MMM", { locale: ptBR }),
          fullMonth: format(monthDate, "MMMM yyyy", { locale: ptBR }),
          receita: totalRevenue
        });
      }

      setMonthlyRevenueData(monthsData);
    } catch (error) {
      console.error("Erro ao carregar dados mensais:", error);
    }
  };

  const handlePayCommission = async (barberId: string, value: number) => {
    if (value <= 0) {
      toast.info("Não há comissão pendente para este barbeiro");
      return;
    }

    setSavingCommissions(prev => ({ ...prev, [barberId]: true }));

    try {
      // Registrar pagamento de comissão
      const { error } = await supabase
        .from("comissoes")
        .insert({
          barbeiro_id: barberId,
          appointment_id: null, // Pagamento manual não vinculado a agendamento específico
          valor: value,
          percentual: barbersData.find(b => b.id === barberId)?.commissionPercent || 30,
          pago: true
        });

      if (error) throw error;

      toast.success("Comissão marcada como paga!");
      loadAllFinancialData();
    } catch (error) {
      console.error("Erro ao marcar comissão como paga:", error);
      toast.error("Erro ao registrar pagamento");
    } finally {
      setSavingCommissions(prev => ({ ...prev, [barberId]: false }));
    }
  };

  // Cálculos consolidados
  const totals = useMemo(() => {
    const totalRevenue = barbersData.reduce((sum, b) => sum + b.totalRevenue, 0);
    const totalCommissions = barbersData.reduce((sum, b) => sum + b.commissionValue, 0);
    const totalPendingCommissions = barbersData.reduce((sum, b) => sum + b.pendingCommission, 0);
    const totalPaidCommissions = barbersData.reduce((sum, b) => sum + b.paidCommission, 0);
    const netRevenue = totalRevenue - totalCommissions;
    const totalAppointments = barbersData.reduce((sum, b) => sum + b.completedAppointments, 0);

    return {
      totalRevenue,
      totalCommissions,
      totalPendingCommissions,
      totalPaidCommissions,
      netRevenue,
      totalAppointments
    };
  }, [barbersData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(value);
  };

  const monthOptions = useMemo(() => {
    const months = [];
    for (let i = 0; i < 6; i++) {
      const date = subMonths(new Date(), i);
      months.push({
        label: format(date, "MMMM yyyy", { locale: ptBR }),
        from: startOfMonth(date),
        to: endOfMonth(date)
      });
    }
    return months;
  }, []);

  const getTrendIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="w-4 h-4" />;
    if (value < 0) return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  const getTrendClass = (value: number) => {
    if (value > 0) return 'text-emerald-400';
    if (value < 0) return 'text-red-400';
    return 'text-muted-foreground';
  };

  const downloadReport = (report: MonthlyReport) => {
    const taxaSucesso = report.total_agendamentos > 0 
      ? ((report.agendamentos_completados / report.total_agendamentos) * 100).toFixed(1) 
      : 0;

    const content = `
═══════════════════════════════════════════════════════════════════════════════
                    RELATÓRIO MENSAL - ${meses[report.mes - 1].toUpperCase()} ${report.ano}
                              DOCUMENTO OFICIAL
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│                           RESUMO FINANCEIRO                                  │
└─────────────────────────────────────────────────────────────────────────────┘

  RECEITA TOTAL DO PERÍODO............ R$ ${report.receita_total.toFixed(2).padStart(12, ' ')}
  
  Detalhamento por Fonte:
    • App (PIX/Cartão)................ R$ ${report.receita_app.toFixed(2).padStart(12, ' ')}
    • Barbearia (Dinheiro)............ R$ ${report.receita_barbearia.toFixed(2).padStart(12, ' ')}
    • Créditos/Fidelidade............. R$ ${report.receita_credito.toFixed(2).padStart(12, ' ')}
    • Planos e Assinaturas............ R$ ${report.receita_plano.toFixed(2).padStart(12, ' ')}
  
  (-) Taxas de Gateway (Asaas)........ R$ ${report.taxas_asaas.toFixed(2).padStart(12, ' ')}
  
  ═══════════════════════════════════════════════════════════════════════════
  LUCRO LÍQUIDO....................... R$ ${report.lucro_liquido.toFixed(2).padStart(12, ' ')}
  ═══════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│                        ESTATÍSTICAS DE ATENDIMENTO                           │
└─────────────────────────────────────────────────────────────────────────────┘

  Total de Agendamentos............... ${String(report.total_agendamentos).padStart(12, ' ')}
  
  Detalhamento:
    ✓ Cortes Concluídos............... ${String(report.agendamentos_completados).padStart(12, ' ')}
    ✗ Cancelamentos................... ${String(report.agendamentos_cancelados).padStart(12, ' ')}
    ⚠ No-shows (Faltas)............... ${String(report.agendamentos_no_show).padStart(12, ' ')}
  
  Taxa de Sucesso..................... ${String(taxaSucesso + '%').padStart(12, ' ')}

┌─────────────────────────────────────────────────────────────────────────────┐
│                     COMPARATIVO COM MÊS ANTERIOR                             │
└─────────────────────────────────────────────────────────────────────────────┘

  Variação de Receita................. ${(report.variacao_receita_percentual > 0 ? '+' : '') + report.variacao_receita_percentual + '%'}
  Variação de Agendamentos............ ${(report.variacao_agendamentos_percentual > 0 ? '+' : '') + report.variacao_agendamentos_percentual + '%'}

${report.resumo_ia ? `
┌─────────────────────────────────────────────────────────────────────────────┐
│                       ANÁLISE INTELIGENTE (IA)                               │
└─────────────────────────────────────────────────────────────────────────────┘

${report.resumo_ia}
` : ''}

═══════════════════════════════════════════════════════════════════════════════
                         INFORMAÇÕES DO DOCUMENTO
───────────────────────────────────────────────────────────────────────────────
  Nº Documento: REL-${report.ano}${String(report.mes).padStart(2, '0')}
  Data de Emissão: ${format(new Date(report.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
  Sistema: Gestão de Barbearia - Módulo Financeiro
═══════════════════════════════════════════════════════════════════════════════
    `.trim();

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `REL-${report.ano}${String(report.mes).padStart(2, '0')}_${meses[report.mes - 1].toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Relatório exportado com sucesso!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Carregando dados financeiros...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            Financeiro Geral
          </h1>
          <p className="text-muted-foreground mt-1">
            Controle completo de receitas, comissões e pagamentos
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={format(dateRange.from, "yyyy-MM")}
            onChange={(e) => {
              const selected = monthOptions.find(m => format(m.from, "yyyy-MM") === e.target.value);
              if (selected) {
                setDateRange({ from: selected.from, to: selected.to });
              }
            }}
            className="h-10 px-4 rounded-lg bg-secondary border border-border text-foreground text-sm"
          >
            {monthOptions.map(month => (
              <option key={format(month.from, "yyyy-MM")} value={format(month.from, "yyyy-MM")}>
                {month.label}
              </option>
            ))}
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadAllFinancialData();
              loadAsaasData();
            }}
            className="gap-2"
          >
            <RefreshCcw className="w-4 h-4" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Cards de Resumo Principal */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Receita Total */}
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Receita Total</p>
                <p className="text-2xl font-bold text-emerald-400 mt-1">
                  {formatCurrency(totals.totalRevenue)}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {totals.totalAppointments} atendimentos
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comissões a Pagar */}
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Comissões a Pagar</p>
                <p className="text-2xl font-bold text-amber-400 mt-1">
                  {formatCurrency(totals.totalPendingCommissions)}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {barbersData.filter(b => b.pendingCommission > 0).length} barbeiros
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Wallet className="w-6 h-6 text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lucro Líquido */}
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Lucro Líquido</p>
                <p className="text-2xl font-bold text-blue-400 mt-1">
                  {formatCurrency(totals.netRevenue)}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Após comissões
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <PiggyBank className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Saldo Asaas */}
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Saldo Asaas</p>
                <p className="text-2xl font-bold text-purple-400 mt-1">
                  {loadingAsaas ? "..." : formatCurrency(asaasData?.balance || 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {loadingAsaas ? "Carregando..." : `Pendente: ${formatCurrency(asaasData?.pendingBalance || 0)}`}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <CircleDollarSign className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs para diferentes visões */}
      <Tabs defaultValue="barbeiros" className="space-y-6">
        <TabsList className="bg-secondary/50 p-1 flex-wrap h-auto gap-1">
          <TabsTrigger value="barbeiros" className="gap-2">
            <Users className="w-4 h-4" />
            Folha de Pagamento
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="gap-2">
            <FileText className="w-4 h-4" />
            Relatórios Mensais
          </TabsTrigger>
          <TabsTrigger value="evolucao" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            Evolução
          </TabsTrigger>
          <TabsTrigger value="metodos" className="gap-2">
            <CreditCard className="w-4 h-4" />
            Métodos de Pagamento
          </TabsTrigger>
          <TabsTrigger value="asaas" className="gap-2">
            <Banknote className="w-4 h-4" />
            Asaas Detalhado
          </TabsTrigger>
        </TabsList>

        {/* Tab: Folha de Pagamento por Barbeiro */}
        <TabsContent value="barbeiros" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-primary" />
                Folha de Pagamento - {format(dateRange.from, "MMMM yyyy", { locale: ptBR })}
              </CardTitle>
              <CardDescription>
                Controle de comissões por barbeiro
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/30">
                      <TableHead>Barbeiro</TableHead>
                      <TableHead className="text-center">Atendimentos</TableHead>
                      <TableHead className="text-right">Receita Gerada</TableHead>
                      <TableHead className="text-center">Comissão</TableHead>
                      <TableHead className="text-right">Valor Comissão</TableHead>
                      <TableHead className="text-right">Pendente</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {barbersData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Nenhum barbeiro ativo encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      barbersData.map(barber => (
                        <TableRow key={barber.id} className="hover:bg-secondary/20">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center overflow-hidden">
                                {barber.foto_url ? (
                                  <img src={barber.foto_url} alt={barber.apelido} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-primary font-bold">
                                    {barber.apelido.charAt(0).toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <span className="font-medium">{barber.apelido}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">
                              {barber.completedAppointments}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-emerald-400">
                            {formatCurrency(barber.totalRevenue)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="gap-1">
                              <Percent className="w-3 h-3" />
                              {barber.commissionPercent}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(barber.commissionValue)}
                          </TableCell>
                          <TableCell className="text-right">
                            {barber.pendingCommission > 0 ? (
                              <span className="text-amber-400 font-medium">
                                {formatCurrency(barber.pendingCommission)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">R$ 0,00</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant={barber.pendingCommission > 0 ? "default" : "ghost"}
                              disabled={barber.pendingCommission <= 0 || savingCommissions[barber.id]}
                              onClick={() => handlePayCommission(barber.id, barber.pendingCommission)}
                              className="gap-1.5"
                            >
                              {savingCommissions[barber.id] ? (
                                <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                              Pagar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Resumo da Folha */}
              <div className="mt-6 p-4 bg-secondary/30 rounded-xl border border-border">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Total Atendimentos</p>
                    <p className="text-xl font-bold text-foreground">{totals.totalAppointments}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Receita Total</p>
                    <p className="text-xl font-bold text-emerald-400">{formatCurrency(totals.totalRevenue)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Total Comissões</p>
                    <p className="text-xl font-bold text-foreground">{formatCurrency(totals.totalCommissions)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Comissões Pendentes</p>
                    <p className="text-xl font-bold text-amber-400">{formatCurrency(totals.totalPendingCommissions)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Evolução da Receita */}
        <TabsContent value="evolucao" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Evolução da Receita (Últimos 6 meses)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyRevenueData}>
                    <defs>
                      <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis 
                      dataKey="month" 
                      stroke="#888" 
                      tick={{ fill: '#888', fontSize: 12 }}
                    />
                    <YAxis 
                      stroke="#888"
                      tick={{ fill: '#888', fontSize: 12 }}
                      tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1a1a1a', 
                        border: '1px solid #333',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [formatCurrency(value), 'Receita']}
                      labelFormatter={(label) => monthlyRevenueData.find(d => d.month === label)?.fullMonth || label}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="receita" 
                      stroke="#EF4444" 
                      strokeWidth={2}
                      fill="url(#colorReceita)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Métodos de Pagamento */}
        <TabsContent value="metodos" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  Distribuição por Método
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentMethodsData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {paymentMethodsData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1a1a1a', 
                          border: '1px solid #333',
                          borderRadius: '8px'
                        }}
                        formatter={(value: number) => [formatCurrency(value), '']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-6 mt-4">
                  {paymentMethodsData.map((method, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: method.color }}
                      />
                      <span className="text-sm text-muted-foreground">{method.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detalhamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {paymentMethodsData.map((method, index) => (
                  <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${method.color}20` }}
                      >
                        {method.name === 'PIX' && <Receipt className="w-5 h-5" style={{ color: method.color }} />}
                        {method.name === 'Cartão' && <CreditCard className="w-5 h-5" style={{ color: method.color }} />}
                        {method.name === 'Dinheiro' && <Banknote className="w-5 h-5" style={{ color: method.color }} />}
                      </div>
                      <span className="font-medium">{method.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold" style={{ color: method.color }}>
                        {formatCurrency(method.value)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {totals.totalRevenue > 0 
                          ? ((method.value / totals.totalRevenue) * 100).toFixed(1)
                          : 0
                        }%
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Asaas Detalhado */}
        <TabsContent value="asaas" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-primary" />
                Dados Financeiros Asaas
              </CardTitle>
              <CardDescription>
                Informações em tempo real da sua conta Asaas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAsaas ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCcw className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : asaasData ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="flex items-center gap-3 mb-3">
                      <Wallet className="w-5 h-5 text-emerald-400" />
                      <span className="text-sm text-muted-foreground">Saldo Disponível</span>
                    </div>
                    <p className="text-2xl font-bold text-emerald-400">
                      {formatCurrency(asaasData.balance)}
                    </p>
                  </div>

                  <div className="p-6 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <div className="flex items-center gap-3 mb-3">
                      <Clock className="w-5 h-5 text-amber-400" />
                      <span className="text-sm text-muted-foreground">Saldo Pendente</span>
                    </div>
                    <p className="text-2xl font-bold text-amber-400">
                      {formatCurrency(asaasData.pendingBalance)}
                    </p>
                  </div>

                  <div className="p-6 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-center gap-3 mb-3">
                      <ArrowUpRight className="w-5 h-5 text-blue-400" />
                      <span className="text-sm text-muted-foreground">Total Recebido</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-400">
                      {formatCurrency(asaasData.totalReceived)}
                    </p>
                  </div>

                  <div className="p-6 rounded-xl bg-red-500/10 border border-red-500/20">
                    <div className="flex items-center gap-3 mb-3">
                      <ArrowDownRight className="w-5 h-5 text-red-400" />
                      <span className="text-sm text-muted-foreground">Total em Taxas</span>
                    </div>
                    <p className="text-2xl font-bold text-red-400">
                      {formatCurrency(asaasData.totalFees)}
                    </p>
                  </div>

                  <div className="p-6 rounded-xl bg-purple-500/10 border border-purple-500/20">
                    <div className="flex items-center gap-3 mb-3">
                      <PiggyBank className="w-5 h-5 text-purple-400" />
                      <span className="text-sm text-muted-foreground">Saldo Líquido</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-400">
                      {formatCurrency(asaasData.netBalance)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Não foi possível carregar dados do Asaas</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={loadAsaasData}
                    className="mt-4 gap-2"
                  >
                    <RefreshCcw className="w-4 h-4" />
                    Tentar novamente
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Relatórios Mensais - Estilo Protheus */}
        <TabsContent value="relatorios" className="space-y-4">
          {selectedReport ? (
            /* Visualização Detalhada do Relatório */
            <div className="space-y-6">
              {/* Header do Relatório */}
              <Card className="overflow-hidden">
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedReport(null)}
                        className="text-slate-300 hover:text-white hover:bg-white/10"
                      >
                        <ChevronRight className="w-4 h-4 mr-1 rotate-180" />
                        Voltar
                      </Button>
                      <Separator orientation="vertical" className="h-6 bg-white/20" />
                      <div>
                        <p className="text-slate-400 text-xs font-medium">Relatório de Fechamento</p>
                        <h2 className="text-xl font-bold text-white">
                          {meses[selectedReport.mes - 1]} de {selectedReport.ano}
                        </h2>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadReport(selectedReport)}
                        className="border-white/20 text-white hover:bg-white/10"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Exportar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.print()}
                        className="border-white/20 text-white hover:bg-white/10"
                      >
                        <Printer className="w-4 h-4 mr-2" />
                        Imprimir
                      </Button>
                      <Badge className="bg-primary/20 text-primary border-0 ml-2">
                        REL-{selectedReport.ano}{String(selectedReport.mes).padStart(2, '0')}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* KPIs Principais */}
                <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-border">
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-5 h-5 text-emerald-400" />
                      <span className="text-sm text-muted-foreground">Receita Total</span>
                    </div>
                    <p className="text-2xl font-bold text-emerald-400">{formatCurrency(selectedReport.receita_total)}</p>
                    <div className={cn("flex items-center gap-1 mt-2 text-xs", getTrendClass(selectedReport.variacao_receita_percentual))}>
                      {getTrendIcon(selectedReport.variacao_receita_percentual)}
                      <span>{selectedReport.variacao_receita_percentual > 0 ? '+' : ''}{selectedReport.variacao_receita_percentual}% vs mês anterior</span>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <PiggyBank className="w-5 h-5 text-blue-400" />
                      <span className="text-sm text-muted-foreground">Lucro Líquido</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-400">{formatCurrency(selectedReport.lucro_liquido)}</p>
                    <p className="text-xs text-muted-foreground mt-2">Após taxas e custos</p>
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-5 h-5 text-purple-400" />
                      <span className="text-sm text-muted-foreground">Atendimentos</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-400">{selectedReport.total_agendamentos}</p>
                    <div className={cn("flex items-center gap-1 mt-2 text-xs", getTrendClass(selectedReport.variacao_agendamentos_percentual))}>
                      {getTrendIcon(selectedReport.variacao_agendamentos_percentual)}
                      <span>{selectedReport.variacao_agendamentos_percentual > 0 ? '+' : ''}{selectedReport.variacao_agendamentos_percentual}% vs mês anterior</span>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-5 h-5 text-amber-400" />
                      <span className="text-sm text-muted-foreground">Taxa de Sucesso</span>
                    </div>
                    <p className="text-2xl font-bold text-amber-400">
                      {selectedReport.total_agendamentos > 0 
                        ? ((selectedReport.agendamentos_completados / selectedReport.total_agendamentos) * 100).toFixed(1) 
                        : "0.0"}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">Cortes concluídos</p>
                  </div>
                </div>
              </Card>

              {/* Detalhamento Financeiro */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Wallet className="w-5 h-5 text-primary" />
                      Receitas por Fonte
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { label: 'App (PIX/Cartão)', value: selectedReport.receita_app, color: 'bg-emerald-500' },
                      { label: 'Barbearia (Dinheiro)', value: selectedReport.receita_barbearia, color: 'bg-amber-500' },
                      { label: 'Créditos/Fidelidade', value: selectedReport.receita_credito, color: 'bg-blue-500' },
                      { label: 'Planos e Assinaturas', value: selectedReport.receita_plano, color: 'bg-purple-500' },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-3 h-3 rounded-full", item.color)} />
                          <span className="text-sm">{item.label}</span>
                        </div>
                        <span className="font-semibold">{formatCurrency(item.value)}</span>
                      </div>
                    ))}
                    <Separator />
                    <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <div className="flex items-center gap-3">
                        <ArrowDownRight className="w-4 h-4 text-red-400" />
                        <span className="text-sm text-red-400">Taxas Asaas</span>
                      </div>
                      <span className="font-semibold text-red-400">-{formatCurrency(selectedReport.taxas_asaas)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Users className="w-5 h-5 text-primary" />
                      Status dos Atendimentos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        <span className="text-sm">Concluídos</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-emerald-400">{selectedReport.agendamentos_completados}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          ({selectedReport.total_agendamentos > 0 
                            ? ((selectedReport.agendamentos_completados / selectedReport.total_agendamentos) * 100).toFixed(1) 
                            : 0}%)
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <div className="flex items-center gap-3">
                        <XCircle className="w-5 h-5 text-red-400" />
                        <span className="text-sm">Cancelados</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-red-400">{selectedReport.agendamentos_cancelados}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          ({selectedReport.total_agendamentos > 0 
                            ? ((selectedReport.agendamentos_cancelados / selectedReport.total_agendamentos) * 100).toFixed(1) 
                            : 0}%)
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <div className="flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-400" />
                        <span className="text-sm">No-shows (Faltas)</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-amber-400">{selectedReport.agendamentos_no_show}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          ({selectedReport.total_agendamentos > 0 
                            ? ((selectedReport.agendamentos_no_show / selectedReport.total_agendamentos) * 100).toFixed(1) 
                            : 0}%)
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Análise IA */}
              {selectedReport.resumo_ia && (
                <Card className="bg-gradient-to-br from-purple-500/5 to-blue-500/5 border-purple-500/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Sparkles className="w-5 h-5 text-purple-400" />
                      Análise Inteligente (IA)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                      {selectedReport.resumo_ia}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            /* Lista de Relatórios */
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      Relatórios Mensais
                    </CardTitle>
                    <CardDescription>
                      Histórico completo de fechamentos mensais
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadReports}
                    disabled={loadingReports}
                    className="gap-2"
                  >
                    <RefreshCcw className={cn("w-4 h-4", loadingReports && "animate-spin")} />
                    Atualizar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingReports ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCcw className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : reports.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Nenhum relatório encontrado</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Os relatórios são gerados automaticamente ao final de cada mês
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reports.map(report => (
                      <div
                        key={report.id}
                        className={cn(
                          "group relative p-4 rounded-xl border border-border/50 bg-secondary/20",
                          "hover:bg-secondary/40 hover:border-primary/30 transition-all duration-300 cursor-pointer"
                        )}
                        onClick={() => setSelectedReport(report)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                              <FileText className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-foreground">
                                {meses[report.mes - 1]} {report.ano}
                              </h3>
                              <p className="text-xs text-muted-foreground">
                                REL-{report.ano}{String(report.mes).padStart(2, '0')} • {format(new Date(report.created_at), "dd/MM/yyyy", { locale: ptBR })}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Receita Total</p>
                              <p className="font-bold text-emerald-400">{formatCurrency(report.receita_total)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Atendimentos</p>
                              <p className="font-bold text-foreground">{report.total_agendamentos}</p>
                            </div>
                            <div className={cn("flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium", 
                              report.variacao_receita_percentual > 0 
                                ? "bg-emerald-500/10 text-emerald-400" 
                                : report.variacao_receita_percentual < 0 
                                  ? "bg-red-500/10 text-red-400" 
                                  : "bg-secondary text-muted-foreground"
                            )}>
                              {getTrendIcon(report.variacao_receita_percentual)}
                              <span>{report.variacao_receita_percentual > 0 ? '+' : ''}{report.variacao_receita_percentual}%</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              Ver Detalhes
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
