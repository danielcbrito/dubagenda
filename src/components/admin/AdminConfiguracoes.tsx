import { Settings } from "lucide-react";
import { Card } from "@/components/ui/card";

export function AdminConfiguracoes() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Configurações</h1>

      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Settings className="w-6 h-6 text-primary" />
          <h3 className="font-semibold text-lg">Configurações Gerais</h3>
        </div>

        <div className="space-y-6">
          <div>
            <h4 className="font-semibold text-sm mb-2">🔗 Integrações</h4>
            <p className="text-xs text-muted-foreground mb-4">
              Configure integrações com serviços externos (Google Calendar, Supabase, etc.)
            </p>
            <p className="text-xs text-muted-foreground">
              Em breve: painéis de configuração de APIs e webhooks.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-2">⚙️ Configurações Avançadas</h4>
            <p className="text-xs text-muted-foreground">
              Configurações técnicas do sistema (em desenvolvimento).
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
