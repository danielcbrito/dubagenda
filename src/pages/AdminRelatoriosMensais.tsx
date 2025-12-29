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
  Trash2, 
  RefreshCw,
  Printer,
  Filter,
  Eye,
  X,
  Calendar,
  DollarSign,
  Users,
  BarChart3,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
  CreditCard,
  Wallet,
  Building2,
  Percent
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
      
      toast.success(`Relatório de ${meses[reportToDelete.mes - 1]}/${reportToDelete.ano} excluído permanentemente`);
      
      // Atualizar lista local e recarregar do servidor para garantir
      setReports(prev => prev.filter(r => r.id !== reportToDelete.id));
      
      if (selectedReport?.id === reportToDelete.id) {
        setSelectedReport(null);
        setViewMode('list');
        navigate('/admin/relatorios-mensais', { replace: true });
      }
    } catch (error: any) {
      console.error('Erro ao excluir relatório:', error);
      toast.error(error.message || 'Erro ao excluir relatório');
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

  const getTrendIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="w-4 h-4" />;
    if (value < 0) return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  const getTrendClass = (value: number) => {
    if (value > 0) return 'text-emerald-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-500';
  };

  const getTrendBgClass = (value: number) => {
    if (value > 0) return 'bg-emerald-50 border-emerald-200';
    if (value < 0) return 'bg-red-50 border-red-200';
    return 'bg-gray-50 border-gray-200';
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-600 font-medium">Carregando relatórios...</p>
        </div>
      </div>
    );
  }

  // ========== VISUALIZAÇÃO DETALHADA DO RELATÓRIO (ESTILO ERP PREMIUM) ==========
  if (viewMode === 'detail' && selectedReport) {
    const taxaSucesso = selectedReport.total_agendamentos > 0 
      ? ((selectedReport.agendamentos_completados / selectedReport.total_agendamentos) * 100).toFixed(1) 
      : "0.0";
    
    const taxaCancelamento = selectedReport.total_agendamentos > 0 
      ? ((selectedReport.agendamentos_cancelados / selectedReport.total_agendamentos) * 100).toFixed(1) 
      : "0.0";

    const taxaNoShow = selectedReport.total_agendamentos > 0 
      ? ((selectedReport.agendamentos_no_show / selectedReport.total_agendamentos) * 100).toFixed(1) 
      : "0.0";

    const ticketMedio = selectedReport.agendamentos_completados > 0 
      ? (selectedReport.receita_total / selectedReport.agendamentos_completados) 
      : 0;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 print:bg-white">
        {/* Header Premium */}
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm sticky top-0 z-50 print:hidden">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={closeReportDetail}
                className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
              <div className="h-6 w-px bg-slate-200" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-slate-900">
                    {meses[selectedReport.mes - 1]} {selectedReport.ano}
                  </h1>
                  <p className="text-xs text-slate-500">
                    REL-{selectedReport.ano}{String(selectedReport.mes).padStart(2, '0')}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadReport(selectedReport)}
                className="border-slate-200 hover:bg-slate-50"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="border-slate-200 hover:bg-slate-50"
              >
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setReportToDelete(selectedReport);
                  setDeleteDialogOpen(true);
                }}
                className="border-red-200 text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir
              </Button>
            </div>
          </div>
        </header>

        {/* Conteúdo Principal */}
        <main className="max-w-7xl mx-auto py-8 px-6 print:py-4 print:px-0">
          {/* Cabeçalho do Documento */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6 print:shadow-none print:border print:rounded-none">
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-8 py-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm font-medium mb-1">Relatório de Fechamento</p>
                  <h2 className="text-2xl font-bold tracking-tight">
                    {meses[selectedReport.mes - 1]} de {selectedReport.ano}
                  </h2>
                </div>
                <div className="text-right">
                  <p className="text-slate-400 text-xs font-medium">DOCUMENTO Nº</p>
                  <p className="text-xl font-mono font-bold">
                    REL-{selectedReport.ano}{String(selectedReport.mes).padStart(2, '0')}
                  </p>
                </div>
              </div>
            </div>

            {/* Cards de KPI Principais */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 border-b border-slate-200">
              {/* Receita Total */}
              <div className="p-6 border-r border-slate-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                  </div>
                  <span className="text-sm font-medium text-slate-600">Receita Total</span>
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  R$ {selectedReport.receita_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <div className={`flex items-center gap-1 mt-2 ${getTrendClass(selectedReport.variacao_receita_percentual)}`}>
                  {getTrendIcon(selectedReport.variacao_receita_percentual)}
                  <span className="text-sm font-medium">
                    {selectedReport.variacao_receita_percentual > 0 ? '+' : ''}{selectedReport.variacao_receita_percentual}% vs mês anterior
                  </span>
                </div>
              </div>

              {/* Lucro Líquido */}
              <div className="p-6 border-r border-slate-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-blue-600" />
                  </div>
                  <span className="text-sm font-medium text-slate-600">Lucro Líquido</span>
                </div>
                <p className="text-2xl font-bold text-emerald-600">
                  R$ {selectedReport.lucro_liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-sm text-slate-500 mt-2">
                  Margem: {selectedReport.receita_total > 0 ? ((selectedReport.lucro_liquido / selectedReport.receita_total) * 100).toFixed(1) : 0}%
                </p>
              </div>

              {/* Total Atendimentos */}
              <div className="p-6 border-r border-slate-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5 text-purple-600" />
                  </div>
                  <span className="text-sm font-medium text-slate-600">Agendamentos</span>
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {selectedReport.total_agendamentos}
                </p>
                <div className={`flex items-center gap-1 mt-2 ${getTrendClass(selectedReport.variacao_agendamentos_percentual)}`}>
                  {getTrendIcon(selectedReport.variacao_agendamentos_percentual)}
                  <span className="text-sm font-medium">
                    {selectedReport.variacao_agendamentos_percentual > 0 ? '+' : ''}{selectedReport.variacao_agendamentos_percentual}%
                  </span>
                </div>
              </div>

              {/* Taxa de Sucesso */}
              <div className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-amber-600" />
                  </div>
                  <span className="text-sm font-medium text-slate-600">Taxa de Sucesso</span>
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {taxaSucesso}%
                </p>
                <p className="text-sm text-slate-500 mt-2">
                  {selectedReport.agendamentos_completados} concluídos
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Coluna Esquerda - Receitas */}
            <div className="lg:col-span-2 space-y-6">
              {/* Detalhamento de Receitas */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    Detalhamento de Receitas
                  </h3>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {/* App */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                          <CreditCard className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">Pagamentos via App</p>
                          <p className="text-xs text-slate-500">PIX e Cartão de Crédito</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-slate-900">
                          R$ {selectedReport.receita_app.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-slate-500">
                          {selectedReport.receita_total > 0 ? ((selectedReport.receita_app / selectedReport.receita_total) * 100).toFixed(1) : 0}% do total
                        </p>
                      </div>
                    </div>

                    {/* Barbearia */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">Pagamentos na Barbearia</p>
                          <p className="text-xs text-slate-500">Dinheiro e pagamentos presenciais</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-slate-900">
                          R$ {selectedReport.receita_barbearia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-slate-500">
                          {selectedReport.receita_total > 0 ? ((selectedReport.receita_barbearia / selectedReport.receita_total) * 100).toFixed(1) : 0}% do total
                        </p>
                      </div>
                    </div>

                    {/* Créditos */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                          <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">Créditos de Fidelidade</p>
                          <p className="text-xs text-slate-500">Programa de pontos e recompensas</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-slate-900">
                          R$ {selectedReport.receita_credito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-slate-500">
                          {selectedReport.receita_total > 0 ? ((selectedReport.receita_credito / selectedReport.receita_total) * 100).toFixed(1) : 0}% do total
                        </p>
                      </div>
                    </div>

                    {/* Planos */}
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg border border-emerald-200">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                          <Calendar className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">Planos e Assinaturas</p>
                          <p className="text-xs text-slate-500">Receita recorrente mensal</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-emerald-700">
                          R$ {selectedReport.receita_plano.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-emerald-600">
                          {selectedReport.receita_total > 0 ? ((selectedReport.receita_plano / selectedReport.receita_total) * 100).toFixed(1) : 0}% do total
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Taxas e Lucro */}
                  <div className="mt-6 pt-6 border-t border-slate-200 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">(-) Taxas de Gateway (Asaas)</span>
                      <span className="font-semibold text-red-600">
                        - R$ {selectedReport.taxas_asaas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                      <span className="font-bold text-emerald-800">LUCRO LÍQUIDO</span>
                      <span className="text-xl font-bold text-emerald-700">
                        R$ {selectedReport.lucro_liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Análise IA */}
              {selectedReport.resumo_ia && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-purple-50">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-violet-600" />
                      Análise Inteligente (IA)
                    </h3>
                  </div>
                  <div className="p-6">
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {selectedReport.resumo_ia}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Coluna Direita - Estatísticas */}
            <div className="space-y-6">
              {/* Estatísticas de Atendimento */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-600" />
                    Estatísticas de Atendimento
                  </h3>
                </div>
                <div className="p-6 space-y-4">
                  {/* Total */}
                  <div className="text-center pb-4 border-b border-slate-100">
                    <p className="text-sm text-slate-500 mb-1">Total de Agendamentos</p>
                    <p className="text-3xl font-bold text-slate-900">{selectedReport.total_agendamentos}</p>
                  </div>

                  {/* Concluídos */}
                  <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                      <span className="text-sm font-medium text-slate-700">Concluídos</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-emerald-700">{selectedReport.agendamentos_completados}</span>
                      <span className="text-xs text-emerald-600 ml-2">({taxaSucesso}%)</span>
                    </div>
                  </div>

                  {/* Cancelados */}
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-5 h-5 text-red-600" />
                      <span className="text-sm font-medium text-slate-700">Cancelados</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-red-700">{selectedReport.agendamentos_cancelados}</span>
                      <span className="text-xs text-red-600 ml-2">({taxaCancelamento}%)</span>
                    </div>
                  </div>

                  {/* No-shows */}
                  <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-amber-600" />
                      <span className="text-sm font-medium text-slate-700">No-shows</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-amber-700">{selectedReport.agendamentos_no_show}</span>
                      <span className="text-xs text-amber-600 ml-2">({taxaNoShow}%)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* KPIs */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-amber-600" />
                    Indicadores (KPIs)
                  </h3>
                </div>
                <div className="p-6 space-y-4">
                  <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Ticket Médio</p>
                    <p className="text-2xl font-bold text-blue-700">
                      R$ {ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                      <p className="text-xs text-slate-500 uppercase mb-1">Sucesso</p>
                      <p className="text-xl font-bold text-emerald-700">{taxaSucesso}%</p>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-lg border border-red-100">
                      <p className="text-xs text-slate-500 uppercase mb-1">Perda</p>
                      <p className="text-xl font-bold text-red-700">
                        {(parseFloat(taxaCancelamento) + parseFloat(taxaNoShow)).toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* Variação */}
                  <div className={`p-4 rounded-lg border ${getTrendBgClass(selectedReport.variacao_receita_percentual)}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">vs Mês Anterior</span>
                      <div className={`flex items-center gap-1 ${getTrendClass(selectedReport.variacao_receita_percentual)}`}>
                        {getTrendIcon(selectedReport.variacao_receita_percentual)}
                        <span className="font-bold">
                          {selectedReport.variacao_receita_percentual > 0 ? '+' : ''}{selectedReport.variacao_receita_percentual}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Info do Documento */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Informações do Documento</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Nº Documento</span>
                    <span className="font-mono font-semibold text-slate-700">REL-{selectedReport.ano}{String(selectedReport.mes).padStart(2, '0')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Data Emissão</span>
                    <span className="text-slate-700">{format(new Date(selectedReport.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Hora</span>
                    <span className="text-slate-700">{format(new Date(selectedReport.created_at), "HH:mm:ss", { locale: ptBR })}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ========== LISTA DE RELATÓRIOS (ESTILO ERP PREMIUM) ==========
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header Premium */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/admin/financeiro')}
              className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <div className="h-6 w-px bg-slate-200" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">Relatórios Mensais</h1>
                <p className="text-xs text-slate-500">
                  {reports.length} {reports.length === 1 ? 'documento' : 'documentos'}
                </p>
              </div>
            </div>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={loadReports}
            className="border-slate-200 hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {/* Barra de Filtros */}
        <div className="max-w-7xl mx-auto px-6 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center gap-4">
          <div className="flex items-center gap-2 text-slate-500">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">Filtros:</span>
          </div>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar por mês ou ano..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white border-slate-200"
            />
          </div>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="h-10 px-4 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os anos</option>
            {uniqueYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          {(searchTerm || yearFilter) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSearchTerm(""); setYearFilter(""); }}
              className="text-slate-500 hover:text-slate-700"
            >
              <X className="w-4 h-4 mr-1" />
              Limpar
            </Button>
          )}
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-7xl mx-auto py-8 px-6">
        {filteredReports.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm text-center py-20">
            <div className="w-16 h-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">
              Nenhum relatório encontrado
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              {searchTerm || yearFilter 
                ? 'Tente ajustar os filtros de busca' 
                : 'Gere um relatório a partir do módulo Financeiro clicando no botão "Gerar Relatório Mensal"'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredReports.map((report) => (
              <div
                key={report.id}
                onClick={() => openReportDetail(report)}
                className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer overflow-hidden group"
              >
                <div className="p-6 flex items-center gap-6">
                  {/* Ícone */}
                  <div className="w-14 h-14 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl flex items-center justify-center group-hover:from-blue-100 group-hover:to-blue-200 transition-colors">
                    <FileText className="w-7 h-7 text-slate-500 group-hover:text-blue-600 transition-colors" />
                  </div>

                  {/* Info Principal */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-bold text-slate-900">
                        {meses[report.mes - 1]} {report.ano}
                      </h3>
                      <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                        REL-{report.ano}{String(report.mes).padStart(2, '0')}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500">
                      Gerado em {format(new Date(report.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>

                  {/* Métricas */}
                  <div className="hidden lg:flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-xs text-slate-500 mb-1">Receita</p>
                      <p className="text-lg font-bold text-slate-900">
                        R$ {report.receita_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500 mb-1">Lucro</p>
                      <p className="text-lg font-bold text-emerald-600">
                        R$ {report.lucro_liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-500 mb-1">Agendamentos</p>
                      <p className="text-lg font-bold text-slate-900">{report.total_agendamentos}</p>
                    </div>
                    <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full ${getTrendBgClass(report.variacao_receita_percentual)}`}>
                      {getTrendIcon(report.variacao_receita_percentual)}
                      <span className={`text-sm font-semibold ${getTrendClass(report.variacao_receita_percentual)}`}>
                        {report.variacao_receita_percentual > 0 ? '+' : ''}{report.variacao_receita_percentual}%
                      </span>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openReportDetail(report)}
                      className="text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                      title="Visualizar"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadReport(report)}
                      className="text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                      title="Exportar"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setReportToDelete(report);
                        setDeleteDialogOpen(true);
                      }}
                      className="text-slate-500 hover:text-red-600 hover:bg-red-50"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Métricas Mobile */}
                <div className="lg:hidden px-6 pb-4 grid grid-cols-4 gap-4 border-t border-slate-100 pt-4">
                  <div>
                    <p className="text-xs text-slate-500">Receita</p>
                    <p className="font-semibold text-slate-900">R$ {report.receita_total.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Lucro</p>
                    <p className="font-semibold text-emerald-600">R$ {report.lucro_liquido.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Agendamentos</p>
                    <p className="font-semibold text-slate-900">{report.total_agendamentos}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Variação</p>
                    <p className={`font-semibold ${getTrendClass(report.variacao_receita_percentual)}`}>
                      {report.variacao_receita_percentual > 0 ? '+' : ''}{report.variacao_receita_percentual}%
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-white border-slate-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900">Confirmar Exclusão Permanente</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600">
              Deseja realmente excluir o relatório de{' '}
              <span className="font-semibold text-slate-900">
                {reportToDelete && `${meses[reportToDelete.mes - 1]} ${reportToDelete.ano}`}
              </span>?
              <br />
              <span className="text-red-600 font-medium">Esta ação é irreversível e o documento será removido permanentemente.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              disabled={deleting}
              className="border-slate-200"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteReport}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Excluir Permanentemente'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
