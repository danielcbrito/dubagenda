import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  Send, 
  Users, 
  CheckCircle, 
  Loader2, 
  MessageSquare,
  Search,
  RefreshCw,
  AlertTriangle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Client {
  id: string;
  nome: string;
  telefone: string | null;
}

export function AdminDisparo() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, telefone")
        .not("telefone", "is", null)
        .order("nome", { ascending: true });

      if (error) throw error;
      setClients(data?.filter(c => c.telefone) || []);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar clientes");
    } finally {
      setLoading(false);
    }
  };

  const formatPhoneForWhatsApp = (phone: string): string => {
    let cleaned = phone.replace(/\D/g, '');
    if (!cleaned.startsWith('55')) {
      cleaned = '55' + cleaned;
    }
    return `${cleaned}@s.whatsapp.net`;
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      const filteredIds = filteredClients.map(c => c.id);
      setSelectedClients(new Set(filteredIds));
    } else {
      setSelectedClients(new Set());
    }
  };

  const handleSelectClient = (clientId: string, checked: boolean) => {
    const newSelected = new Set(selectedClients);
    if (checked) {
      newSelected.add(clientId);
    } else {
      newSelected.delete(clientId);
    }
    setSelectedClients(newSelected);
    setSelectAll(newSelected.size === filteredClients.length);
  };

  const handleSendMessages = async () => {
    if (selectedClients.size === 0) {
      toast.error("Selecione pelo menos um cliente");
      return;
    }

    if (!message.trim()) {
      toast.error("Digite uma mensagem");
      return;
    }

    // Get webhook config - usando o webhook de disparo específico
    // IMPORTANTE: garantimos pegar a config mais recente (evita erro quando existem múltiplas linhas)
    const { data: config, error: configError } = await supabase
      .from("webhook_config")
      .select("disparo_webhook_url, disparo_ativo")
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (configError || !config?.disparo_webhook_url || !config?.disparo_ativo) {
      toast.error("Webhook de disparo não configurado ou inativo. Configure em TI > Webhooks");
      return;
    }

    const webhookUrl = config.disparo_webhook_url;

    setSending(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      const selectedClientsList = clients.filter(c => selectedClients.has(c.id));

      for (const client of selectedClientsList) {
        try {
          // Send to webhook with the message
          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              evento: "disparo_mensagem",
              cliente_id: client.id,
              cliente_nome: client.nome,
              cliente_telefone: client.telefone,
              cliente_telefone_whatsapp: formatPhoneForWhatsApp(client.telefone!),
              mensagem: message.replace("{nome}", client.nome),
              timestamp: new Date().toISOString()
            }),
          });

          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (e) {
          errorCount++;
          console.error(`Erro ao enviar para ${client.nome}:`, e);
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} mensagem(ns) enviada(s) com sucesso!`);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} mensagem(ns) falharam`);
      }

      // Log the dispatch
      await supabase.from("system_logs").insert({
        level: "info",
        category: "disparo",
        message: `Disparo de mensagens: ${successCount} sucesso, ${errorCount} falhas`,
        details: {
          total: selectedClients.size,
          success: successCount,
          errors: errorCount,
          message_preview: message.substring(0, 100)
        }
      });

      // Reset form
      setMessage("");
      setSelectedClients(new Set());
      setSelectAll(false);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao enviar mensagens");
    } finally {
      setSending(false);
    }
  };

  const filteredClients = clients.filter(client =>
    client.nome.toLowerCase().includes(search.toLowerCase()) ||
    client.telefone?.includes(search)
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Disparo de Mensagens</h1>
          <p className="text-sm text-muted-foreground">
            Envie mensagens via WhatsApp para seus clientes
          </p>
        </div>
        <Button onClick={loadClients} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
          Atualizar Lista
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Clients Selection */}
        <div className="space-y-4">
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <h2 className="font-semibold">Selecionar Clientes</h2>
              </div>
              <span className="text-sm text-muted-foreground">
                {selectedClients.size} selecionado(s)
              </span>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Buscar por nome ou telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Select All */}
            <div className="flex items-center gap-2 p-3 bg-secondary/30 rounded-lg mb-3">
              <Checkbox
                id="select-all"
                checked={selectAll}
                onCheckedChange={handleSelectAll}
              />
              <Label htmlFor="select-all" className="cursor-pointer text-sm font-medium">
                Selecionar todos ({filteredClients.length})
              </Label>
            </div>

            {/* Clients List */}
            {loading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Carregando...</p>
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="p-8 text-center">
                <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nenhum cliente com telefone cadastrado
                </p>
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto space-y-1 scrollbar-none">
                {filteredClients.map((client) => (
                  <div
                    key={client.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                      selectedClients.has(client.id) 
                        ? "bg-primary/10 border border-primary/20" 
                        : "hover:bg-secondary/50"
                    )}
                    onClick={() => handleSelectClient(client.id, !selectedClients.has(client.id))}
                  >
                    <Checkbox
                      checked={selectedClients.has(client.id)}
                      onCheckedChange={(checked) => handleSelectClient(client.id, checked as boolean)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{client.nome}</p>
                      <p className="text-xs text-muted-foreground">{client.telefone}</p>
                    </div>
                    {selectedClients.has(client.id) && (
                      <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Message Composition */}
        <div className="space-y-4">
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-5 h-5 text-primary" />
              <h2 className="font-semibold">Compor Mensagem</h2>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm mb-2 block">Mensagem</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={`Olá {nome}! 

Temos novidades especiais para você...`}
                  className="min-h-[200px] resize-none"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  💡 Use <code className="bg-secondary/50 px-1 rounded">{"{nome}"}</code> para personalizar com o nome do cliente
                </p>
              </div>

              {/* Preview */}
              {message && (
                <div className="p-4 bg-secondary/30 rounded-lg border">
                  <p className="text-xs text-muted-foreground mb-2">Prévia:</p>
                  <p className="text-sm whitespace-pre-wrap">
                    {message.replace("{nome}", "João")}
                  </p>
                </div>
              )}

              {/* Warning */}
              <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-200">
                  As mensagens serão enviadas via webhook para o n8n. Certifique-se de que o webhook está configurado corretamente em TI &gt; Webhooks.
                </p>
              </div>

              {/* Send Button */}
              <Button
                onClick={handleSendMessages}
                disabled={sending || selectedClients.size === 0 || !message.trim()}
                className="w-full gap-2"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enviando ({selectedClients.size})...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Disparar Mensagem ({selectedClients.size})
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
