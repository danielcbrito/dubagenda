import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";

export function AdminFinanceiro() {
  const [generating, setGenerating] = useState(false);

  const handleGenerateReport = () => {
    setGenerating(true);
    // TODO: Implement AI-powered financial report generation
    toast.info("Funcionalidade em desenvolvimento");
    setTimeout(() => setGenerating(false), 1000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Financeiro</h1>
        <Button onClick={handleGenerateReport} disabled={generating}>
          <Download className="w-4 h-4 mr-2" />
          Gerar Relatório
        </Button>
      </div>

      <Card className="p-6 card-premium">
        <h3 className="font-semibold text-lg mb-4">Controle Financeiro</h3>
        <p className="text-muted-foreground">
          Sistema financeiro completo em desenvolvimento. Em breve você terá acesso a:
        </p>
        <ul className="list-disc list-inside text-muted-foreground mt-4 space-y-2">
          <li>Receitas por método de pagamento (Cartão/PIX)</li>
          <li>Controle de despesas por categoria</li>
          <li>Custos por serviço (produtos + mão de obra)</li>
          <li>Comissões de barbeiros</li>
          <li>Relatórios mensais exportáveis (PDF/CSV)</li>
          <li>Análises automáticas com IA</li>
        </ul>
      </Card>
    </div>
  );
}
