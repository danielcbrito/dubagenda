import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminSuporteTickets } from "@/components/admin/AdminSuporteTickets";
import { SupportChatWidget } from "@/components/support/SupportChatWidget";

/**
 * Página de suporte para admin
 * Mostra tickets de suporte + chat com IA
 */
export default function SupportAdmin() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Suporte</h1>
        <p className="text-muted-foreground">
          Gerencie tickets e use o chat com IA para ajudar usuários
        </p>
      </div>

      <Tabs defaultValue="tickets" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
          <TabsTrigger value="chat">Chat IA</TabsTrigger>
        </TabsList>

        <TabsContent value="tickets" className="mt-6">
          <AdminSuporteTickets />
        </TabsContent>

        <TabsContent value="chat" className="mt-6">
          <div className="h-[calc(100vh-250px)] border border-border rounded-2xl overflow-hidden">
            <SupportChatWidget onClose={() => {}} fullScreen />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}