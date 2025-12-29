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
  ChevronRight
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

RESUMO FINANCEIRO
───────────────────────────────────────────────────────────────────────────────
Receita Total:               R$ ${report.receita_total.toFixed(2)}
  ├─ App (PIX/Cartão):       R$ ${report.receita_app.toFixed(2)}
  ├─ Barbearia (Dinheiro):   R$ ${report.receita_barbearia.toFixed(2)}
  ├─ Créditos:               R$ ${report.receita_credito.toFixed(2)}
  └─ Planos/Assinaturas:     R$ ${report.receita_plano.toFixed(2)}

Taxas de Gateway (Asaas):    R$ ${report.taxas_asaas.toFixed(2)}
Lucro Líquido:               R$ ${report.lucro_liquido.toFixed(2)}

AGENDAMENTOS DO MÊS
───────────────────────────────────────────────────────────────────────────────
Total de Agendamentos:       ${report.total_agendamentos}
Cortes Concluídos:           ${report.agendamentos_completados}
Cancelamentos:               ${report.agendamentos_cancelados}
No-shows (faltas):           ${report.agendamentos_no_show}
Taxa de Sucesso:             ${taxaSucesso}%

COMPARATIVO COM MÊS ANTERIOR
───────────────────────────────────────────────────────────────────────────────
Variação Receita:            ${report.variacao_receita_percentual > 0 ? '+' : ''}${report.variacao_receita_percentual}%
Variação Agendamentos:       ${report.variacao_agendamentos_percentual > 0 ? '+' : ''}${report.variacao_agendamentos_percentual}%

${report.resumo_ia ? `
ANÁLISE INTELIGENTE (IA)
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

  const getTrendIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="w-4 h-4 text-emerald-600" />;
    if (value < 0) return <TrendingDown className="w-4 h-4 text-red-600" />;
    return <Minus className="w-4 h-4 text-gray-500" />;
  };

  const getTrendClass = (value: number) => {
    if (value > 0) return 'text-emerald-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-500';
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
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-600" />
          <p className="text-sm text-gray-600">Carregando relatórios...</p>
        </div>
      </div>
    );
  }

  // ========== VISUALIZAÇÃO DETALHADA DO RELATÓRIO (ESTILO ERP) ==========
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

    return (
      <div className="min-h-screen bg-[#F5F5F5]">
        {/* Header Toolbar - Estilo ERP */}
        <header className="bg-white border-b border-gray-300 shadow-sm sticky top-0 z-50">
          <div className="px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={closeReportDetail}
                className="h-8 px-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Voltar
              </Button>
              <div className="h-5 w-px bg-gray-300" />
              <FileText className="w-5 h-5 text-gray-600" />
              <div>
                <h1 className="text-sm font-semibold text-gray-900">
                  Relatório Mensal: {meses[selectedReport.mes - 1]} {selectedReport.ano}
                </h1>
                <p className="text-xs text-gray-500">
                  Gerado em {format(new Date(selectedReport.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadReport(selectedReport)}
                className="h-8 text-xs border-gray-300 hover:bg-gray-100"
              >
                <Download className="w-4 h-4 mr-1" />
                Exportar TXT
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="h-8 text-xs border-gray-300 hover:bg-gray-100"
              >
                <Printer className="w-4 h-4 mr-1" />
                Imprimir
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setReportToDelete(selectedReport);
                  setDeleteDialogOpen(true);
                }}
                className="h-8 text-xs border-red-300 text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Excluir
              </Button>
            </div>
          </div>
        </header>

        {/* Conteúdo do Relatório - Estilo Folha/Documento */}
        <main className="max-w-5xl mx-auto py-6 px-4">
          <div className="bg-white border border-gray-300 shadow-lg">
            {/* Cabeçalho do Documento */}
            <div className="border-b border-gray-300 bg-gray-50 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 uppercase tracking-wide">
                    Relatório de Fechamento Mensal
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Período: {meses[selectedReport.mes - 1]} de {selectedReport.ano}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Documento Nº</p>
                  <p className="text-sm font-mono font-semibold text-gray-700">
                    REL-{selectedReport.ano}{String(selectedReport.mes).padStart(2, '0')}
                  </p>
                </div>
              </div>
            </div>

            {/* Seção 1: Resumo Financeiro */}
            <div className="border-b border-gray-200">
              <div className="bg-gray-100 px-6 py-2 border-b border-gray-200">
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                  1. Resumo Financeiro
                </h3>
              </div>
              <div className="px-6 py-4">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="py-2 text-gray-600 font-medium w-1/2">Receita Total do Período</td>
                      <td className="py-2 text-right font-semibold text-gray-900">
                        R$ {selectedReport.receita_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 pl-4 w-32">
                        <div className={`flex items-center gap-1 justify-end ${getTrendClass(selectedReport.variacao_receita_percentual)}`}>
                          {getTrendIcon(selectedReport.variacao_receita_percentual)}
                          <span className="text-xs font-medium">
                            {selectedReport.variacao_receita_percentual > 0 ? '+' : ''}{selectedReport.variacao_receita_percentual}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="mt-4 pl-4 border-l-2 border-gray-200">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Detalhamento por Origem</p>
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b border-gray-50">
                        <td className="py-1.5 text-gray-600">├ Pagamentos via App (PIX/Cartão)</td>
                        <td className="py-1.5 text-right font-medium text-gray-800">
                          R$ {selectedReport.receita_app.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                      <tr className="border-b border-gray-50">
                        <td className="py-1.5 text-gray-600">├ Pagamentos na Barbearia (Dinheiro)</td>
                        <td className="py-1.5 text-right font-medium text-gray-800">
                          R$ {selectedReport.receita_barbearia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                      <tr className="border-b border-gray-50">
                        <td className="py-1.5 text-gray-600">├ Utilização de Créditos</td>
                        <td className="py-1.5 text-right font-medium text-gray-800">
                          R$ {selectedReport.receita_credito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 text-gray-600">└ Planos e Assinaturas</td>
                        <td className="py-1.5 text-right font-medium text-gray-800">
                          R$ {selectedReport.receita_plano.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b border-gray-100">
                        <td className="py-2 text-gray-600">(-) Taxas de Gateway (Asaas)</td>
                        <td className="py-2 text-right font-medium text-red-600">
                          - R$ {selectedReport.taxas_asaas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                      <tr className="bg-gray-50">
                        <td className="py-3 text-gray-900 font-bold">LUCRO LÍQUIDO</td>
                        <td className="py-3 text-right text-lg font-bold text-emerald-700">
                          R$ {selectedReport.lucro_liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Seção 2: Estatísticas de Atendimento */}
            <div className="border-b border-gray-200">
              <div className="bg-gray-100 px-6 py-2 border-b border-gray-200">
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                  2. Estatísticas de Atendimento
                </h3>
              </div>
              <div className="px-6 py-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="py-2 text-left text-gray-600 font-semibold">Descrição</th>
                      <th className="py-2 text-right text-gray-600 font-semibold w-24">Qtd.</th>
                      <th className="py-2 text-right text-gray-600 font-semibold w-24">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="py-2 text-gray-900 font-medium">Total de Agendamentos no Período</td>
                      <td className="py-2 text-right font-bold text-gray-900">{selectedReport.total_agendamentos}</td>
                      <td className="py-2 text-right text-gray-600">100%</td>
                    </tr>
                    <tr className="border-b border-gray-50">
                      <td className="py-2 text-gray-600 pl-4">├ Atendimentos Concluídos</td>
                      <td className="py-2 text-right font-medium text-emerald-700">{selectedReport.agendamentos_completados}</td>
                      <td className="py-2 text-right text-emerald-600">{taxaSucesso}%</td>
                    </tr>
                    <tr className="border-b border-gray-50">
                      <td className="py-2 text-gray-600 pl-4">├ Cancelamentos</td>
                      <td className="py-2 text-right font-medium text-red-600">{selectedReport.agendamentos_cancelados}</td>
                      <td className="py-2 text-right text-red-600">{taxaCancelamento}%</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-600 pl-4">└ Não Comparecimentos (No-show)</td>
                      <td className="py-2 text-right font-medium text-amber-600">{selectedReport.agendamentos_no_show}</td>
                      <td className="py-2 text-right text-amber-600">{taxaNoShow}%</td>
                    </tr>
                  </tbody>
                </table>

                <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                  <span className="text-sm text-gray-600">Variação em relação ao mês anterior:</span>
                  <div className={`flex items-center gap-2 ${getTrendClass(selectedReport.variacao_agendamentos_percentual)}`}>
                    {getTrendIcon(selectedReport.variacao_agendamentos_percentual)}
                    <span className="text-sm font-semibold">
                      {selectedReport.variacao_agendamentos_percentual > 0 ? '+' : ''}{selectedReport.variacao_agendamentos_percentual}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Seção 3: Indicadores de Desempenho */}
            <div className="border-b border-gray-200">
              <div className="bg-gray-100 px-6 py-2 border-b border-gray-200">
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                  3. Indicadores de Desempenho (KPIs)
                </h3>
              </div>
              <div className="px-6 py-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="border border-gray-200 p-4 text-center bg-gray-50">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Taxa de Sucesso</p>
                    <p className="text-2xl font-bold text-emerald-700">{taxaSucesso}%</p>
                  </div>
                  <div className="border border-gray-200 p-4 text-center bg-gray-50">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Ticket Médio</p>
                    <p className="text-2xl font-bold text-gray-900">
                      R$ {selectedReport.agendamentos_completados > 0 
                        ? (selectedReport.receita_total / selectedReport.agendamentos_completados).toFixed(2)
                        : '0.00'}
                    </p>
                  </div>
                  <div className="border border-gray-200 p-4 text-center bg-gray-50">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Taxa Cancelamento</p>
                    <p className="text-2xl font-bold text-red-600">{taxaCancelamento}%</p>
                  </div>
                  <div className="border border-gray-200 p-4 text-center bg-gray-50">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Taxa No-Show</p>
                    <p className="text-2xl font-bold text-amber-600">{taxaNoShow}%</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Seção 4: Análise IA (se disponível) */}
            {selectedReport.resumo_ia && (
              <div className="border-b border-gray-200">
                <div className="bg-gray-100 px-6 py-2 border-b border-gray-200">
                  <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                    4. Análise e Insights (IA)
                  </h3>
                </div>
                <div className="px-6 py-4">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {selectedReport.resumo_ia}
                  </p>
                </div>
              </div>
            )}

            {/* Rodapé do Documento */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div>
                  <p>Sistema de Gestão - Barbearia</p>
                  <p>Documento gerado automaticamente</p>
                </div>
                <div className="text-right">
                  <p>Data de Emissão: {format(new Date(selectedReport.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
                  <p>Hora: {format(new Date(selectedReport.created_at), "HH:mm:ss", { locale: ptBR })}</p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ========== LISTA DE RELATÓRIOS (ESTILO ERP) ==========
  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      {/* Header Toolbar - Estilo ERP */}
      <header className="bg-white border-b border-gray-300 shadow-sm sticky top-0 z-50">
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/admin/financeiro')}
              className="h-8 px-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Voltar
            </Button>
            <div className="h-5 w-px bg-gray-300" />
            <FileText className="w-5 h-5 text-gray-600" />
            <div>
              <h1 className="text-sm font-semibold text-gray-900">
                Relatórios Mensais de Fechamento
              </h1>
              <p className="text-xs text-gray-500">
                {reports.length} {reports.length === 1 ? 'relatório disponível' : 'relatórios disponíveis'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadReports}
              className="h-8 text-xs border-gray-300 hover:bg-gray-100"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Barra de Filtros */}
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex items-center gap-3">
          <Filter className="w-4 h-4 text-gray-500" />
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar por mês ou ano..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 text-sm bg-white border-gray-300"
            />
          </div>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="h-8 px-3 text-sm rounded border border-gray-300 bg-white focus:outline-none focus:ring-1 focus:ring-gray-400"
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
              className="h-8 text-xs text-gray-600"
            >
              <X className="w-4 h-4 mr-1" />
              Limpar
            </Button>
          )}
        </div>
      </header>

      {/* Conteúdo Principal - Grid/Tabela de Relatórios */}
      <main className="max-w-6xl mx-auto py-6 px-4">
        {filteredReports.length === 0 ? (
          <div className="bg-white border border-gray-300 shadow-sm text-center py-16">
            <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <h3 className="text-sm font-semibold text-gray-600 mb-1">
              Nenhum relatório encontrado
            </h3>
            <p className="text-xs text-gray-500">
              {searchTerm || yearFilter ? 'Tente ajustar os filtros' : 'Gere um relatório a partir do módulo Financeiro'}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-gray-300 shadow-sm">
            {/* Cabeçalho da Tabela */}
            <div className="bg-gray-100 border-b border-gray-300 px-4 py-2.5 grid grid-cols-12 gap-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
              <div className="col-span-3">Período</div>
              <div className="col-span-2 text-right">Receita</div>
              <div className="col-span-2 text-right">Lucro Líquido</div>
              <div className="col-span-2 text-center">Agendamentos</div>
              <div className="col-span-2 text-center">Variação</div>
              <div className="col-span-1 text-center">Ações</div>
            </div>

            {/* Linhas de Relatórios */}
            {filteredReports.map((report, index) => (
              <div
                key={report.id}
                className={`px-4 py-3 grid grid-cols-12 gap-4 items-center text-sm border-b border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer ${
                  index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                }`}
                onClick={() => openReportDetail(report)}
              >
                {/* Período */}
                <div className="col-span-3">
                  <p className="font-semibold text-gray-900">
                    {meses[report.mes - 1]} {report.ano}
                  </p>
                  <p className="text-xs text-gray-500">
                    Gerado em {format(new Date(report.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>

                {/* Receita */}
                <div className="col-span-2 text-right">
                  <p className="font-semibold text-gray-900">
                    R$ {report.receita_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>

                {/* Lucro */}
                <div className="col-span-2 text-right">
                  <p className="font-semibold text-emerald-700">
                    R$ {report.lucro_liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>

                {/* Agendamentos */}
                <div className="col-span-2 text-center">
                  <p className="font-semibold text-gray-900">{report.total_agendamentos}</p>
                  <p className="text-xs text-gray-500">{report.agendamentos_completados} concluídos</p>
                </div>

                {/* Variação */}
                <div className="col-span-2 flex justify-center">
                  <div className={`flex items-center gap-1 ${getTrendClass(report.variacao_receita_percentual)}`}>
                    {getTrendIcon(report.variacao_receita_percentual)}
                    <span className="text-xs font-medium">
                      {report.variacao_receita_percentual > 0 ? '+' : ''}{report.variacao_receita_percentual}%
                    </span>
                  </div>
                </div>

                {/* Ações */}
                <div className="col-span-1 flex justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openReportDetail(report)}
                    className="h-8 w-8 p-0 text-gray-600 hover:text-gray-900"
                    title="Visualizar"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => downloadReport(report)}
                    className="h-8 w-8 p-0 text-gray-600 hover:text-gray-900"
                    title="Baixar"
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
                    className="h-8 w-8 p-0 text-gray-600 hover:text-red-600"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-white border-gray-300">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900">Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              Deseja realmente excluir o relatório de{' '}
              <span className="font-semibold text-gray-900">
                {reportToDelete && `${meses[reportToDelete.mes - 1]} ${reportToDelete.ano}`}
              </span>?
              <br />
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              disabled={deleting}
              className="border-gray-300"
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
                'Excluir Relatório'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
