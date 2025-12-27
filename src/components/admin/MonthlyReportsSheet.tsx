import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, TrendingUp, TrendingDown, Minus, Calendar, DollarSign, Users, Download, Sparkles } from "lucide-react";
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

interface Props {
  children: React.ReactNode;
}

const meses = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function MonthlyReportsSheet({ children }: Props) {
  const [open, setOpen] = useState(false);
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState<MonthlyReport | null>(null);

  useEffect(() => {
    if (open) {
      loadReports();
    }
  }, [open]);

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

  const downloadReport = (report: MonthlyReport) => {
    const content = `
═══════════════════════════════════════════════════════════════
              RELATÓRIO MENSAL - ${meses[report.mes - 1].toUpperCase()} ${report.ano}
═══════════════════════════════════════════════════════════════

📊 RESUMO FINANCEIRO
────────────────────────────────────────────────────────────────
Receita Total:           R$ ${report.receita_total.toFixed(2)}
  ├─ App (PIX/Cartão):   R$ ${report.receita_app.toFixed(2)}
  ├─ Barbearia:          R$ ${report.receita_barbearia.toFixed(2)}
  ├─ Créditos:           R$ ${report.receita_credito.toFixed(2)}
  └─ Planos:             R$ ${report.receita_plano.toFixed(2)}

Taxas de Gateway:        R$ ${report.taxas_asaas.toFixed(2)}
Lucro Líquido:           R$ ${report.lucro_liquido.toFixed(2)}

📅 AGENDAMENTOS
────────────────────────────────────────────────────────────────
Total:                   ${report.total_agendamentos}
Concluídos:              ${report.agendamentos_completados}
Cancelados:              ${report.agendamentos_cancelados}
No-shows:                ${report.agendamentos_no_show}
Taxa de Sucesso:         ${report.total_agendamentos > 0 ? ((report.agendamentos_completados / report.total_agendamentos) * 100).toFixed(1) : 0}%

📈 COMPARATIVO COM MÊS ANTERIOR
────────────────────────────────────────────────────────────────
Variação Receita:        ${report.variacao_receita_percentual > 0 ? '+' : ''}${report.variacao_receita_percentual}%
Variação Agendamentos:   ${report.variacao_agendamentos_percentual > 0 ? '+' : ''}${report.variacao_agendamentos_percentual}%

${report.resumo_ia ? `
🤖 ANÁLISE INTELIGENTE
────────────────────────────────────────────────────────────────
${report.resumo_ia}
` : ''}

═══════════════════════════════════════════════════════════════
Relatório gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
═══════════════════════════════════════════════════════════════
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
    if (value > 0) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (value < 0) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-2xl bg-background border-border">
        <SheetHeader className="pb-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-foreground">
            <FileText className="w-5 h-5 text-primary" />
            Relatórios Mensais
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-4 pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum relatório gerado ainda</p>
              <p className="text-sm text-muted-foreground mt-2">
                Clique em "Exportar" para gerar seu primeiro relatório
              </p>
            </div>
          ) : selectedReport ? (
            // Vista detalhada do relatório
            <div className="space-y-4">
              <Button
                variant="ghost"
                onClick={() => setSelectedReport(null)}
                className="mb-2"
              >
                ← Voltar aos relatórios
              </Button>

              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">
                  {meses[selectedReport.mes - 1]} {selectedReport.ano}
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadReport(selectedReport)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Baixar
                </Button>
              </div>

              {/* Cards de métricas */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="glass-card">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <DollarSign className="w-5 h-5 text-green-500" />
                      {getTrendIcon(selectedReport.variacao_receita_percentual)}
                    </div>
                    <p className="text-2xl font-bold text-green-500 mt-2">
                      R$ {selectedReport.receita_total.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">Receita Total</p>
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <Users className="w-5 h-5 text-blue-500" />
                      {getTrendIcon(selectedReport.variacao_agendamentos_percentual)}
                    </div>
                    <p className="text-2xl font-bold text-blue-500 mt-2">
                      {selectedReport.agendamentos_completados}
                    </p>
                    <p className="text-xs text-muted-foreground">Atendimentos</p>
                  </CardContent>
                </Card>
              </div>

              {/* Breakdown de receita */}
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Origem da Receita</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">App (PIX/Cartão)</span>
                    <span className="font-medium text-green-500">R$ {selectedReport.receita_app.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Barbearia (Dinheiro)</span>
                    <span className="font-medium text-amber-500">R$ {selectedReport.receita_barbearia.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Créditos</span>
                    <span className="font-medium text-purple-500">R$ {selectedReport.receita_credito.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Planos</span>
                    <span className="font-medium text-cyan-500">R$ {selectedReport.receita_plano.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-border pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Taxas Gateway</span>
                      <span className="font-medium text-red-500">-R$ {selectedReport.taxas_asaas.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-sm font-medium">Lucro Líquido</span>
                      <span className="font-bold text-primary">R$ {selectedReport.lucro_liquido.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Estatísticas de agendamentos */}
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Estatísticas de Agendamentos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total</span>
                    <span className="font-medium">{selectedReport.total_agendamentos}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Concluídos</span>
                    <Badge variant="outline" className="bg-green-500/10 text-green-500">
                      {selectedReport.agendamentos_completados}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Cancelados</span>
                    <Badge variant="outline" className="bg-red-500/10 text-red-500">
                      {selectedReport.agendamentos_cancelados}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">No-shows</span>
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-500">
                      {selectedReport.agendamentos_no_show}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Resumo IA */}
              {selectedReport.resumo_ia && (
                <Card className="glass-card border-primary/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      Análise Inteligente
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedReport.resumo_ia}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            // Lista de relatórios
            <div className="space-y-3">
              {reports.map((report) => (
                <Card
                  key={report.id}
                  className="glass-card cursor-pointer hover:border-primary/50 transition-all"
                  onClick={() => setSelectedReport(report)}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Calendar className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {meses[report.mes - 1]} {report.ano}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            R$ {report.receita_total.toFixed(2)} • {report.agendamentos_completados} atendimentos
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getTrendIcon(report.variacao_receita_percentual)}
                        <span className={`text-sm font-medium ${
                          report.variacao_receita_percentual > 0 ? 'text-green-500' :
                          report.variacao_receita_percentual < 0 ? 'text-red-500' : 'text-muted-foreground'
                        }`}>
                          {report.variacao_receita_percentual > 0 ? '+' : ''}
                          {report.variacao_receita_percentual}%
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
