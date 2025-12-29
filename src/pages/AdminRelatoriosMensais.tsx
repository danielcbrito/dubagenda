import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { 
  FileText, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Calendar, 
  DollarSign, 
  Users, 
  Download, 
  Sparkles, 
  ArrowLeft, 
  Search, 
  Trash2, 
  RefreshCw,
  ChevronRight,
  BarChart3,
  CreditCard,
  Wallet,
  Star,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  Scissors,
  Banknote,
  Smartphone,
  Gift,
  X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

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

const meses = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function AdminRelatoriosMensais() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedId = searchParams.get('id');
  
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [yearFilter, setYearFilter] = useState<string>("");
  const [selectedReport, setSelectedReport] = useState<MonthlyReport | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<MonthlyReport | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadReports();
  }, []);

  useEffect(() => {
    if (selectedId && reports.length > 0) {
      const report = reports.find(r => r.id === selectedId);
      if (report) {
        setSelectedReport(report);
        setViewMode('detail');
      }
    }
  }, [selectedId, reports]);

  const loadReports = async () => {
    setLoading(true);
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
      toast.error('Erro ao carregar relatórios');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReport = async () => {
    if (!reportToDelete) return;
    
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('relatorios_mensais')
        .delete()
        .eq('id', reportToDelete.id);

      if (error) throw error;
      
      toast.success(`Relatório de ${meses[reportToDelete.mes - 1]}/${reportToDelete.ano} excluído`);
      setReports(prev => prev.filter(r => r.id !== reportToDelete.id));
      
      if (selectedReport?.id === reportToDelete.id) {
        setSelectedReport(null);
        setViewMode('list');
        navigate('/admin/relatorios-mensais', { replace: true });
      }
    } catch (error) {
      console.error('Erro ao excluir relatório:', error);
      toast.error('Erro ao excluir relatório');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setReportToDelete(null);
    }
  };

  const openReportDetail = (report: MonthlyReport) => {
    setSelectedReport(report);
    setViewMode('detail');
    navigate(`/admin/relatorios-mensais?id=${report.id}`, { replace: true });
  };

  const closeReportDetail = () => {
    setSelectedReport(null);
    setViewMode('list');
    navigate('/admin/relatorios-mensais', { replace: true });
  };

  const downloadReport = (report: MonthlyReport) => {
    const taxaSucesso = report.total_agendamentos > 0 
      ? ((report.agendamentos_completados / report.total_agendamentos) * 100).toFixed(1) 
      : 0;

    const content = `
═══════════════════════════════════════════════════════════════════════════════
                    RELATÓRIO MENSAL - ${meses[report.mes - 1].toUpperCase()} ${report.ano}
═══════════════════════════════════════════════════════════════════════════════

📊 RESUMO FINANCEIRO
───────────────────────────────────────────────────────────────────────────────
Receita Total:               R$ ${report.receita_total.toFixed(2)}
  ├─ App (PIX/Cartão):       R$ ${report.receita_app.toFixed(2)}
  ├─ Barbearia (Dinheiro):   R$ ${report.receita_barbearia.toFixed(2)}
  ├─ Créditos:               R$ ${report.receita_credito.toFixed(2)}
  └─ Planos/Assinaturas:     R$ ${report.receita_plano.toFixed(2)}

Taxas de Gateway (Asaas):    R$ ${report.taxas_asaas.toFixed(2)}
Lucro Líquido:               R$ ${report.lucro_liquido.toFixed(2)}

📅 AGENDAMENTOS DO MÊS
───────────────────────────────────────────────────────────────────────────────
Total de Agendamentos:       ${report.total_agendamentos}
Cortes Concluídos:           ${report.agendamentos_completados}
Cancelamentos:               ${report.agendamentos_cancelados}
No-shows (faltas):           ${report.agendamentos_no_show}
Taxa de Sucesso:             ${taxaSucesso}%

📈 COMPARATIVO COM MÊS ANTERIOR
───────────────────────────────────────────────────────────────────────────────
Variação Receita:            ${report.variacao_receita_percentual > 0 ? '+' : ''}${report.variacao_receita_percentual}%
Variação Agendamentos:       ${report.variacao_agendamentos_percentual > 0 ? '+' : ''}${report.variacao_agendamentos_percentual}%

${report.resumo_ia ? `
🤖 ANÁLISE INTELIGENTE
───────────────────────────────────────────────────────────────────────────────
${report.resumo_ia}
` : ''}

═══════════════════════════════════════════════════════════════════════════════
Relatório gerado em: ${format(new Date(report.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
Sistema de Gestão - Barbearia
═══════════════════════════════════════════════════════════════════════════════
    `.trim();

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_${meses[report.mes - 1].toLowerCase()}_${report.ano}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Relatório baixado com sucesso!');
  };

  const getTrendIcon = (value: number, size: "sm" | "lg" = "sm") => {
    const sizeClass = size === "lg" ? "w-6 h-6" : "w-5 h-5";
    if (value > 0) return <TrendingUp className={`${sizeClass} text-green-500`} />;
    if (value < 0) return <TrendingDown className={`${sizeClass} text-red-500`} />;
    return <Minus className={`${sizeClass} text-muted-foreground`} />;
  };

  const getTrendColor = (value: number) => {
    if (value > 0) return 'text-green-500';
    if (value < 0) return 'text-red-500';
    return 'text-muted-foreground';
  };

  // Filtrar relatórios
  const filteredReports = reports.filter(report => {
    const searchMatch = searchTerm === "" || 
      meses[report.mes - 1].toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.ano.toString().includes(searchTerm);
    
    const yearMatch = yearFilter === "" || report.ano.toString() === yearFilter;
    
    return searchMatch && yearMatch;
  });

  // Anos únicos para filtro
  const uniqueYears = [...new Set(reports.map(r => r.ano))].sort((a, b) => b - a);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0E0E11] flex items-center justify-center">
        <div className="text-center space-y-4">
          <RefreshCw className="w-10 h-10 animate-spin mx-auto text-primary" />
          <p className="text-lg text-muted-foreground">Carregando relatórios...</p>
        </div>
      </div>
    );
  }

  // ========== VISUALIZAÇÃO DETALHADA DO RELATÓRIO ==========
  if (viewMode === 'detail' && selectedReport) {
    const taxaSucesso = selectedReport.total_agendamentos > 0 
      ? ((selectedReport.agendamentos_completados / selectedReport.total_agendamentos) * 100).toFixed(1) 
      : "0";

    return (
      <div className="min-h-screen bg-[#0E0E11] relative overflow-hidden">
        {/* Efeitos de luz premium */}
        <div className="pointer-events-none fixed inset-0 z-0">
          <div className="absolute -top-32 -right-32 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[150px] animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute -bottom-48 -left-48 w-[500px] h-[500px] bg-primary/15 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary/5 rounded-full blur-[200px]" />
        </div>

        <div className="relative z-10">
          {/* Header Fixo */}
          <motion.header 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="sticky top-0 z-50 bg-[#0E0E11]/80 backdrop-blur-xl border-b border-border/30"
          >
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={closeReportDetail}
                    className="shrink-0 hover:bg-muted/50"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <div>
                    <h1 className="text-xl md:text-2xl font-bold text-foreground">
                      Relatório de {meses[selectedReport.mes - 1]} {selectedReport.ano}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      Gerado em {format(new Date(selectedReport.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => downloadReport(selectedReport)}
                    className="gap-2 hidden sm:flex"
                  >
                    <Download className="w-4 h-4" />
                    Baixar Relatório
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => downloadReport(selectedReport)}
                    className="sm:hidden"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setReportToDelete(selectedReport);
                      setDeleteDialogOpen(true);
                    }}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </motion.header>

          {/* Conteúdo Principal */}
          <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-8">
            {/* Hero Section - Métricas Principais */}
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Receita Total */}
                <Card className="relative overflow-hidden bg-gradient-to-br from-green-500/20 via-green-500/10 to-transparent border-green-500/30 group hover:border-green-500/50 transition-all">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                  <CardContent className="p-6 relative">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-14 h-14 rounded-2xl bg-green-500/20 flex items-center justify-center">
                        <DollarSign className="w-7 h-7 text-green-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Receita Total</p>
                        <div className={`flex items-center gap-2 ${getTrendColor(selectedReport.variacao_receita_percentual)}`}>
                          {getTrendIcon(selectedReport.variacao_receita_percentual)}
                          <span className="text-sm font-medium">
                            {selectedReport.variacao_receita_percentual > 0 ? '+' : ''}{selectedReport.variacao_receita_percentual}% vs mês anterior
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className="text-4xl md:text-5xl font-bold text-green-500 tracking-tight">
                      R$ {selectedReport.receita_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </CardContent>
                </Card>

                {/* Total Agendamentos */}
                <Card className="relative overflow-hidden bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-transparent border-blue-500/30 group hover:border-blue-500/50 transition-all">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                  <CardContent className="p-6 relative">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-14 h-14 rounded-2xl bg-blue-500/20 flex items-center justify-center">
                        <Scissors className="w-7 h-7 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Agendamentos</p>
                        <div className={`flex items-center gap-2 ${getTrendColor(selectedReport.variacao_agendamentos_percentual)}`}>
                          {getTrendIcon(selectedReport.variacao_agendamentos_percentual)}
                          <span className="text-sm font-medium">
                            {selectedReport.variacao_agendamentos_percentual > 0 ? '+' : ''}{selectedReport.variacao_agendamentos_percentual}% vs mês anterior
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className="text-4xl md:text-5xl font-bold text-blue-500 tracking-tight">
                      {selectedReport.total_agendamentos}
                    </p>
                  </CardContent>
                </Card>

                {/* Lucro Líquido */}
                <Card className="relative overflow-hidden bg-gradient-to-br from-purple-500/20 via-purple-500/10 to-transparent border-purple-500/30 group hover:border-purple-500/50 transition-all">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                  <CardContent className="p-6 relative">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-14 h-14 rounded-2xl bg-purple-500/20 flex items-center justify-center">
                        <BarChart3 className="w-7 h-7 text-purple-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Lucro Líquido</p>
                        <p className="text-sm text-muted-foreground">
                          Após taxas de gateway
                        </p>
                      </div>
                    </div>
                    <p className="text-4xl md:text-5xl font-bold text-purple-500 tracking-tight">
                      R$ {selectedReport.lucro_liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </CardContent>
                </Card>

                {/* Taxa de Sucesso */}
                <Card className="relative overflow-hidden bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-transparent border-amber-500/30 group hover:border-amber-500/50 transition-all">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                  <CardContent className="p-6 relative">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center">
                        <Star className="w-7 h-7 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Taxa de Sucesso</p>
                        <p className="text-sm text-muted-foreground">
                          Concluídos / Total
                        </p>
                      </div>
                    </div>
                    <p className="text-4xl md:text-5xl font-bold text-amber-500 tracking-tight">
                      {taxaSucesso}%
                    </p>
                  </CardContent>
                </Card>
              </div>
            </motion.section>

            {/* Seção: Origem da Receita */}
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="bg-card/50 backdrop-blur-xl border-border/50 overflow-hidden">
                <CardHeader className="border-b border-border/30 bg-muted/20">
                  <CardTitle className="text-xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                      <Wallet className="w-5 h-5 text-primary" />
                    </div>
                    Origem da Receita
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border/30">
                    {/* App */}
                    <div className="p-6 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                          <Smartphone className="w-6 h-6 text-green-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">App (PIX/Cartão)</p>
                          <p className="text-xs text-muted-foreground/70">Pagamentos online</p>
                        </div>
                      </div>
                      <p className="text-3xl font-bold text-green-500">
                        R$ {selectedReport.receita_app.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    {/* Barbearia */}
                    <div className="p-6 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                          <Banknote className="w-6 h-6 text-amber-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Barbearia (Dinheiro)</p>
                          <p className="text-xs text-muted-foreground/70">Pagamentos presenciais</p>
                        </div>
                      </div>
                      <p className="text-3xl font-bold text-amber-500">
                        R$ {selectedReport.receita_barbearia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    {/* Créditos */}
                    <div className="p-6 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                          <CreditCard className="w-6 h-6 text-purple-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Créditos</p>
                          <p className="text-xs text-muted-foreground/70">Créditos utilizados</p>
                        </div>
                      </div>
                      <p className="text-3xl font-bold text-purple-500">
                        R$ {selectedReport.receita_credito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    {/* Planos */}
                    <div className="p-6 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                          <Gift className="w-6 h-6 text-cyan-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Planos/Assinaturas</p>
                          <p className="text-xs text-muted-foreground/70">Mensalidades</p>
                        </div>
                      </div>
                      <p className="text-3xl font-bold text-cyan-500">
                        R$ {selectedReport.receita_plano.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  {/* Taxas */}
                  <div className="border-t border-border/30 p-6 bg-red-500/5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                          <AlertTriangle className="w-5 h-5 text-red-500" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Taxas de Gateway (Asaas)</p>
                          <p className="text-sm text-muted-foreground">Descontado automaticamente</p>
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-red-500">
                        - R$ {selectedReport.taxas_asaas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.section>

            {/* Seção: Estatísticas de Agendamentos */}
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="bg-card/50 backdrop-blur-xl border-border/50 overflow-hidden">
                <CardHeader className="border-b border-border/30 bg-muted/20">
                  <CardTitle className="text-xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-primary" />
                    </div>
                    Estatísticas de Agendamentos
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                    {/* Total */}
                    <div className="relative overflow-hidden p-6 rounded-2xl bg-muted/30 border border-border/30 group hover:border-primary/30 transition-all">
                      <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                      <div className="relative">
                        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-4">
                          <Users className="w-6 h-6 text-primary" />
                        </div>
                        <p className="text-4xl md:text-5xl font-bold text-foreground mb-2">
                          {selectedReport.total_agendamentos}
                        </p>
                        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                          Total do Mês
                        </p>
                      </div>
                    </div>

                    {/* Concluídos */}
                    <div className="relative overflow-hidden p-6 rounded-2xl bg-green-500/10 border border-green-500/30 group hover:border-green-500/50 transition-all">
                      <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                      <div className="relative">
                        <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center mb-4">
                          <CheckCircle2 className="w-6 h-6 text-green-500" />
                        </div>
                        <p className="text-4xl md:text-5xl font-bold text-green-500 mb-2">
                          {selectedReport.agendamentos_completados}
                        </p>
                        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                          Concluídos
                        </p>
                      </div>
                    </div>

                    {/* Cancelados */}
                    <div className="relative overflow-hidden p-6 rounded-2xl bg-red-500/10 border border-red-500/30 group hover:border-red-500/50 transition-all">
                      <div className="absolute top-0 right-0 w-20 h-20 bg-red-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                      <div className="relative">
                        <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center mb-4">
                          <XCircle className="w-6 h-6 text-red-500" />
                        </div>
                        <p className="text-4xl md:text-5xl font-bold text-red-500 mb-2">
                          {selectedReport.agendamentos_cancelados}
                        </p>
                        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                          Cancelados
                        </p>
                      </div>
                    </div>

                    {/* No-shows */}
                    <div className="relative overflow-hidden p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 group hover:border-amber-500/50 transition-all">
                      <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                      <div className="relative">
                        <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center mb-4">
                          <AlertTriangle className="w-6 h-6 text-amber-500" />
                        </div>
                        <p className="text-4xl md:text-5xl font-bold text-amber-500 mb-2">
                          {selectedReport.agendamentos_no_show}
                        </p>
                        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                          No-shows
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.section>

            {/* Seção: Análise IA */}
            {selectedReport.resumo_ia && (
              <motion.section 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/30 overflow-hidden">
                  <CardHeader className="border-b border-primary/20 bg-primary/5">
                    <CardTitle className="text-xl flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-primary" />
                      </div>
                      Análise Inteligente
                      <Badge variant="outline" className="ml-2 bg-primary/10 text-primary border-primary/20">
                        IA
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <p className="text-lg text-foreground/90 whitespace-pre-wrap leading-relaxed">
                      {selectedReport.resumo_ia}
                    </p>
                  </CardContent>
                </Card>
              </motion.section>
            )}
          </main>
        </div>
      </div>
    );
  }

  // ========== LISTA DE RELATÓRIOS ==========
  return (
    <div className="min-h-screen bg-[#0E0E11] relative overflow-hidden">
      {/* Efeitos de luz premium */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-primary/15 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute -bottom-48 -left-48 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 p-4 md:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-8"
        >
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate('/admin/financeiro')}
            className="shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
              <FileText className="w-8 h-8 text-primary" />
              Relatórios Mensais
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Selecione um mês para visualizar o relatório completo
            </p>
          </div>
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-base px-4 py-2">
            {reports.length} {reports.length === 1 ? 'relatório' : 'relatórios'}
          </Badge>
        </motion.div>

        {/* Filtros */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col sm:flex-row gap-4 mb-8"
        >
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Buscar por mês ou ano..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 h-12 bg-card/50 border-border/50 text-base"
            />
          </div>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="h-12 px-4 rounded-lg bg-card/50 border border-border/50 text-base focus:outline-none focus:ring-2 focus:ring-primary/50 min-w-[150px]"
          >
            <option value="">Todos os anos</option>
            {uniqueYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </motion.div>

        {/* Grid de Relatórios */}
        {filteredReports.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <FileText className="w-20 h-20 mx-auto text-muted-foreground/30 mb-6" />
            <h3 className="text-xl font-medium text-muted-foreground mb-2">
              Nenhum relatório encontrado
            </h3>
            {searchTerm && (
              <p className="text-muted-foreground/70">
                Tente buscar por outro termo
              </p>
            )}
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredReports.map((report, index) => (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card 
                  className="bg-card/50 backdrop-blur-xl border-border/50 overflow-hidden cursor-pointer group hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all"
                  onClick={() => openReportDetail(report)}
                >
                  {/* Header colorido */}
                  <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent p-6 border-b border-border/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          <Calendar className="w-7 h-7 text-primary group-hover:text-primary-foreground" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-foreground">
                            {meses[report.mes - 1]}
                          </h3>
                          <p className="text-sm text-muted-foreground">{report.ano}</p>
                        </div>
                      </div>
                      <div className={`flex items-center gap-2 ${getTrendColor(report.variacao_receita_percentual)}`}>
                        {getTrendIcon(report.variacao_receita_percentual, "lg")}
                        <span className="text-lg font-bold">
                          {report.variacao_receita_percentual > 0 ? '+' : ''}{report.variacao_receita_percentual}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Conteúdo */}
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {/* Receita */}
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Receita Total</span>
                        <span className="text-2xl font-bold text-green-500">
                          R$ {report.receita_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Agendamentos */}
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Agendamentos</span>
                        <span className="text-xl font-semibold text-foreground">
                          {report.total_agendamentos}
                        </span>
                      </div>

                      {/* Detalhes pequenos */}
                      <div className="pt-4 border-t border-border/30 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1 text-green-500">
                            <CheckCircle2 className="w-4 h-4" />
                            {report.agendamentos_completados}
                          </span>
                          <span className="flex items-center gap-1 text-red-500">
                            <XCircle className="w-4 h-4" />
                            {report.agendamentos_cancelados}
                          </span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="gap-2 text-primary hover:text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            openReportDetail(report);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                          Ver detalhes
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">Excluir Relatório?</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Você está prestes a excluir o relatório de{' '}
              <strong className="text-foreground">{reportToDelete ? `${meses[reportToDelete.mes - 1]}/${reportToDelete.ano}` : ''}</strong>.
              <br /><br />
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="h-11">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteReport}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-11"
            >
              {deleting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
