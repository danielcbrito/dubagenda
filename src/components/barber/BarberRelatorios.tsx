import { Card, CardContent } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

interface BarberRelatoriosProps {
  barbeiroId: string;
}

export function BarberRelatorios({ barbeiroId }: BarberRelatoriosProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Meus Relatórios</h1>
      <Card className="bg-card/50 border-border/50">
        <CardContent className="py-12 text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Relatórios detalhados em breve</p>
          <p className="text-sm text-muted-foreground mt-2">Acompanhe seus atendimentos e comissões no Financeiro</p>
        </CardContent>
      </Card>
    </div>
  );
}
