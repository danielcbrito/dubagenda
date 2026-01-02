import { Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminMensagens } from "@/components/admin/AdminMensagens";
import { AdminSuporteConfig } from "@/components/admin/AdminSuporteConfig";
import { toast } from "sonner";

export function TIConfiguracoes() {
  const handleGoogleCalendarInfo = () => {
    toast.info(
      "As credenciais do Google Calendar foram configuradas com sucesso. " +
        "Para atualizá-las, entre em contato com o suporte técnico.",
      { duration: 5000 }
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-wide text-foreground">
          <span className="text-cyan-400">Configurações</span> do Sistema
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie as configurações gerais do sistema
        </p>
      </div>

      <Tabs defaultValue="integrations" className="w-full">
        <TabsList className="bg-[#12121a] border border-cyan-500/20">
          <TabsTrigger
            value="integrations"
            className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400"
          >
            Integrações
          </TabsTrigger>
          <TabsTrigger
            value="messages"
            className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400"
          >
            Mensagens
          </TabsTrigger>
          <TabsTrigger
            value="support"
            className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400"
          >
            Suporte
          </TabsTrigger>
        </TabsList>

        <TabsContent value="integrations" className="mt-6">
          <Card className="p-6 bg-gradient-to-br from-[#12121a] to-[#0d0d14] border-cyan-500/10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="font-semibold">Google Calendar</h3>
                <p className="text-xs text-muted-foreground">Sincronização de agendamentos</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-black/20 rounded-lg border border-cyan-500/10">
                <div>
                  <p className="font-medium text-sm">Status da Integração</p>
                  <p className="text-xs text-muted-foreground">Configurado e ativo</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-xs text-emerald-400">Conectado</span>
                </div>
              </div>

              <button
                onClick={handleGoogleCalendarInfo}
                className="w-full px-4 py-2 bg-cyan-500/10 text-cyan-400 rounded-lg text-sm hover:bg-cyan-500/20 transition-colors border border-cyan-500/20"
              >
                Ver Detalhes da Integração
              </button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="messages" className="mt-6">
          <AdminMensagens />
        </TabsContent>

        <TabsContent value="support" className="mt-6">
          <AdminSuporteConfig />
        </TabsContent>
      </Tabs>
    </div>
  );
}
