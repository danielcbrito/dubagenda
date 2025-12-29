import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Download, 
  ArrowLeft, 
  Search, 
  Printer,
  Filter,
  Eye,
  X,
  Calendar,
  DollarSign,
  BarChart3,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BarberMonthlyStats {
  mes: number;
  ano: number;
  receita_total: number;
  total_agendamentos: number;
  agendamentos_completados: number;
  agendamentos_cancelados: number;
  agendamentos_no_show: number;
  comissao_total: number;
}

const meses = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function BarberRelatoriosMensais() {
  const navigate = useNavigate();
  const [barbeiroId, setBarbeiroId] = useState<string | null>(null);
  const [comissaoPct, setComissaoPct] = useState(0);
  const [reports, setReports] = useState<BarberMonthlyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [yearFilter, setYearFilter] = useState<string>("");
  const [selectedReport, setSelectedReport] = useState<BarberMonthlyStats | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');

  useEffect(() => {
    loadBarberData();
  }, []);

  useEffect(() => {
    if (barbeiroId) {
      loadReports();
    }
  }, [barbeiroId]);

  const loadBarberData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data: barbeiro, error } = await supabase
        .from("barbeiros")
        .select("id, comissao_pct")
        .eq("user_id", session.user.id)
        .single();

      if (error || !barbeiro) {
        toast.error("Erro ao carregar dados do barbeiro");
        navigate("/barbeiro");
        return;
      }

      setBarbeiroId(barbeiro.id);
      setComissaoPct(barbeiro.comissao_pct || 50);
    } catch (error) {
      console.error("Erro:", error);
    }
  };

  const loadReports = async () => {
    if (!barbeiroId) return;
    
    setLoading(true);
    try {
      // Buscar todos os agendamentos do barbeiro agrupados por mês/ano
      const { data: agendamentos, error } = await supabase
        .from('agendamentos')
        .select('data, preco, status')
        .eq('barbeiro_id', barbeiroId)
        .not('status', 'in', '("excluido")');

      if (error) throw error;

      // Agrupar por mês/ano
      const monthlyData: Record<string, BarberMonthlyStats> = {};

      (agendamentos || []).forEach(apt => {
        const date = new Date(apt.data);
        const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
        
        if (!monthlyData[key]) {
          monthlyData[key] = {
            mes: date.getMonth() + 1,
            ano: date.getFullYear(),
            receita_total: 0,
            total_agendamentos: 0,
            agendamentos_completados: 0,
            agendamentos_cancelados: 0,
            agendamentos_no_show: 0,
            comissao_total: 0,
          };
        }

        monthlyData[key].total_agendamentos++;

        if (apt.status === 'completed') {
          monthlyData[key].agendamentos_completados++;
          monthlyData[key].receita_total += apt.preco || 0;
          monthlyData[key].comissao_total += (apt.preco || 0) * (comissaoPct / 100);
        } else if (apt.status === 'cancelled_by_admin' || apt.status === 'cancelled_by_user') {
          monthlyData[key].agendamentos_cancelados++;
        } else if (apt.status === 'no_show') {
          monthlyData[key].agendamentos_no_show++;
        }
      });

      // Converter para array e ordenar
      const reportsArray = Object.values(monthlyData).sort((a, b) => {
        if (a.ano !== b.ano) return b.ano - a.ano;
        return b.mes - a.mes;
      });

      setReports(reportsArray);
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error);
      toast.error('Erro ao carregar relatórios');
    } finally {
      setLoading(false);
    }
  };

  const openReportDetail = (report: BarberMonthlyStats) => {
    setSelectedReport(report);
    setViewMode('detail');
  };

  const closeReportDetail = () => {
    setSelectedReport(null);
    setViewMode('list');
  };

  const downloadReport = (report: BarberMonthlyStats) => {
    const taxaSucesso = report.total_agendamentos > 0 
      ? ((report.agendamentos_completados / report.total_agendamentos) * 100).toFixed(1) 
      : 0;

    const content = `
═══════════════════════════════════════════════════════════════════════════════
                    RELATÓRIO MENSAL - ${meses[report.mes - 1].toUpperCase()} ${report.ano}
                              MEU DESEMPENHO
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│                           RESUMO FINANCEIRO                                  │
└─────────────────────────────────────────────────────────────────────────────┘

  RECEITA GERADA........................ R$ ${report.receita_total.toFixed(2).padStart(12, ' ')}
  
  Minha Comissão (${comissaoPct}%)............. R$ ${report.comissao_total.toFixed(2).padStart(12, ' ')}

┌─────────────────────────────────────────────────────────────────────────────┐
│                        ESTATÍSTICAS DE ATENDIMENTO                           │
└─────────────────────────────────────────────────────────────────────────────┘

  Total de Agendamentos............... ${String(report.total_agendamentos).padStart(12, ' ')}
  
  Detalhamento:
    ✓ Cortes Concluídos............... ${String(report.agendamentos_completados).padStart(12, ' ')}
    ✗ Cancelamentos................... ${String(report.agendamentos_cancelados).padStart(12, ' ')}
    ⚠ No-shows (Faltas)............... ${String(report.agendamentos_no_show).padStart(12, ' ')}
  
  Taxa de Sucesso..................... ${String(taxaSucesso + '%').padStart(12, ' ')}

═══════════════════════════════════════════════════════════════════════════════
    `.trim();

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MEU-REL-${report.ano}${String(report.mes).padStart(2, '0')}_${meses[report.mes - 1].toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Relatório exportado com sucesso!');
  };

  const getTrendIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="w-4 h-4" />;
    if (value < 0) return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
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
          <div className="w-16 h-16 mx-auto border-4 border-border border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Carregando relatórios...</p>
        </div>
      </div>
    );
  }

  // ========== VISUALIZAÇÃO DETALHADA ==========
  if (viewMode === 'detail' && selectedReport) {
    const taxaSucesso = selectedReport.total_agendamentos > 0 
      ? ((selectedReport.agendamentos_completados / selectedReport.total_agendamentos) * 100).toFixed(1) 
      : "0.0";
    
    const taxaCancelamento = selectedReport.total_agendamentos > 0 
      ? ((selectedReport.agendamentos_cancelados / selectedReport.total_agendamentos) * 100).toFixed(1) 
      : "0.0";

    const ticketMedio = selectedReport.agendamentos_completados > 0 
      ? (selectedReport.receita_total / selectedReport.agendamentos_completados) 
      : 0;

    return (
      <div className="min-h-screen bg-[#0E0E11]">
        {/* Header */}
        <header className="bg-card/50 backdrop-blur-md border-b border-border/50 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={closeReportDetail}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center shadow-glow-red">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-foreground">
                    {meses[selectedReport.mes - 1]} {selectedReport.ano}
                  </h1>
                  <p className="text-xs text-muted-foreground">Meu Desempenho</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadReport(selectedReport)}
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
              >
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </Button>
            </div>
          </div>
        </header>

        {/* Conteúdo Principal */}
        <main className="max-w-7xl mx-auto py-8 px-6">
          {/* Cards de KPI */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {/* Receita Gerada */}
            <div className="bg-card/50 border border-border/50 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Receita Gerada</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                R$ {selectedReport.receita_total.toFixed(0)}
              </p>
            </div>

            {/* Minha Comissão */}
            <div className="bg-card/50 border border-border/50 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-primary" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Minha Comissão ({comissaoPct}%)</span>
              </div>
              <p className="text-2xl font-bold text-primary">
                R$ {selectedReport.comissao_total.toFixed(0)}
              </p>
            </div>

            {/* Cortes Realizados */}
            <div className="bg-card/50 border border-border/50 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-blue-400" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Cortes Realizados</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {selectedReport.agendamentos_completados}
              </p>
            </div>

            {/* Taxa de Sucesso */}
            <div className="bg-card/50 border border-border/50 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-amber-400" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Taxa de Sucesso</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {taxaSucesso}%
              </p>
            </div>
          </div>

          {/* Detalhes */}
          <div className="bg-card/50 border border-border/50 rounded-xl p-6">
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Detalhamento de Atendimentos
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-emerald-400">{selectedReport.agendamentos_completados}</p>
                <p className="text-sm text-muted-foreground">Concluídos</p>
              </div>
              
              <div className="text-center p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-red-400">{selectedReport.agendamentos_cancelados}</p>
                <p className="text-sm text-muted-foreground">Cancelados</p>
              </div>
              
              <div className="text-center p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Clock className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-amber-400">{selectedReport.agendamentos_no_show}</p>
                <p className="text-sm text-muted-foreground">No-shows</p>
              </div>
            </div>

            {/* Ticket Médio */}
            <div className="mt-6 p-4 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Ticket Médio</span>
                <span className="text-xl font-bold text-foreground">R$ {ticketMedio.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ========== LISTAGEM ==========
  return (
    <div className="min-h-screen bg-[#0E0E11]">
      {/* Header */}
      <header className="bg-card/50 backdrop-blur-md border-b border-border/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/barbeiro')}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center shadow-glow-red">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">Meus Relatórios</h1>
                  <p className="text-xs text-muted-foreground">Histórico de desempenho mensal</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Filtros */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por mês ou ano..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-card/50 border-border/50"
            />
          </div>
          
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="px-4 py-2 rounded-lg bg-card/50 border border-border/50 text-foreground"
          >
            <option value="">Todos os anos</option>
            {uniqueYears.map(year => (
              <option key={year} value={year.toString()}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista de Relatórios */}
      <div className="max-w-7xl mx-auto px-6 pb-8">
        {filteredReports.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground mb-2">
              Nenhum relatório encontrado
            </h3>
            <p className="text-sm text-muted-foreground">
              {reports.length === 0 
                ? "Você ainda não possui agendamentos registrados."
                : "Tente ajustar os filtros de busca."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredReports.map((report, index) => (
              <div
                key={`${report.ano}-${report.mes}`}
                onClick={() => openReportDetail(report)}
                className="group bg-card/50 border border-border/50 rounded-xl p-6 cursor-pointer transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">
                      {meses[report.mes - 1]}
                    </h3>
                    <p className="text-sm text-muted-foreground">{report.ano}</p>
                  </div>
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Receita Gerada</span>
                    <span className="font-semibold text-foreground">R$ {report.receita_total.toFixed(0)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Minha Comissão</span>
                    <span className="font-semibold text-primary">R$ {report.comissao_total.toFixed(0)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Cortes</span>
                    <span className="font-semibold text-foreground">{report.agendamentos_completados}</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border/30 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {report.total_agendamentos} agendamentos
                  </span>
                  <Button variant="ghost" size="sm" className="text-primary">
                    <Eye className="w-4 h-4 mr-1" />
                    Ver
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}