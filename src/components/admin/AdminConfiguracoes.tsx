import { Card } from "@/components/ui/card";
import { Settings } from "lucide-react";

export function AdminConfiguracoes() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Configurações</h1>

      <Card className="p-6 card-premium">
        <div className="flex items-center gap-3 mb-4">
          <Settings className="w-6 h-6 text-primary" />
          <h3 className="font-semibold text-lg">Configurações do Sistema</h3>
        </div>
        <p className="text-muted-foreground">
          Painel de configurações em desenvolvimento. Em breve você poderá:
        </p>
        <ul className="list-disc list-inside text-muted-foreground mt-4 space-y-2">
          <li>Gerenciar chaves de API (OpenAI, Mercado Pago)</li>
          <li>Editar planos de assinatura</li>
          <li>Configurar preços de serviços</li>
          <li>Gerenciar dados da barbearia</li>
          <li>Definir horários de funcionamento</li>
          <li>Personalizar notificações</li>
        </ul>
      </Card>
    </div>
  );
}
