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
  Loader2, 
  Search,
  RefreshCw,
  Clock,
  Trash2,
  Play
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Client {
  id: string;
  nome: string;
  telefone: string | null;
}

interface ScheduledDispatch {
  id: string;
  mensagem: string;
  contatos_ids: string[];
  data_programada: string;
  executado: boolean;
  created_at: string;
}

export function AdminDisparo() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledDispatches, setScheduledDispatches] = useState<ScheduledDispatch[]>([]);
  const [loadingScheduled, setLoadingScheduled] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  useEffect(() => {
    loadClients();
    loadScheduledDispatches();
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

  const loadScheduledDispatches = async () => {
    setLoadingScheduled(true);
    try {
      const { data, error } = await supabase
        .from("disparos_programados")
        .select("*")
        .eq("executado", false)
        .order("data_programada", { ascending: true });

      if (error) throw error;
      setScheduledDispatches(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingScheduled(false);
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

    const { data: config, error: configError } = await supabase
      .from("webhook_config")
      .select("disparo_webhook_url, disparo_ativo")
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (configError || !config?.disparo_webhook_url || !config?.disparo_ativo) {
      toast.error("Webhook de disparo não configurado. Configure em TI > Webhooks");
      return;
    }

    const webhookUrl = config.disparo_webhook_url;

    setSending(true);

    try {
      const selectedClientsList = clients.filter(c => selectedClients.has(c.id));

      const contatos = selectedClientsList.map((client) => ({
        cliente_id: client.id,
        cliente_nome: client.nome,
        cliente_telefone: client.telefone,
        cliente_telefone_whatsapp: formatPhoneForWhatsApp(client.telefone!),
        mensagem: message.replace("{nome}", client.nome)
      }));

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evento: "disparo_mensagem_lote",
          total_contatos: contatos.length,
          contatos: contatos,
          timestamp: new Date().toISOString()
        }),
      });

      if (response.ok) {
        toast.success(`${contatos.length} mensagem(ns) enviada(s) com sucesso`);
      } else {
        toast.error("Erro ao enviar. Verifique o webhook.");
      }

      await supabase.from("system_logs").insert({
        level: "info",
        category: "disparo",
        message: `Disparo em lote: ${contatos.length} contatos`,
        details: {
          total: contatos.length,
          contatos: contatos,
          message_preview: message.substring(0, 100)
        }
      });

      setMessage("");
      setSelectedClients(new Set());
      setSelectAll(false);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao enviar disparo");
    } finally {
      setSending(false);
    }
  };

  const handleScheduleDispatch = async () => {
    if (selectedClients.size === 0) {
      toast.error("Selecione pelo menos um cliente");
      return;
    }

    if (!message.trim()) {
      toast.error("Digite uma mensagem");
      return;
    }

    if (!scheduledDate) {
      toast.error("Selecione data e hora");
      return;
    }

    const scheduledTime = new Date(scheduledDate);
    if (scheduledTime <= new Date()) {
      toast.error("A data/hora deve ser no futuro");
      return;
    }

    setScheduling(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("disparos_programados")
        .insert({
          mensagem: message,
          contatos_ids: Array.from(selectedClients),
          data_programada: scheduledTime.toISOString(),
          created_by: user?.id
        });

      if (error) throw error;

      toast.success(`Agendado para ${format(scheduledTime, "dd/MM 'às' HH:mm", { locale: ptBR })}`);
      
      setMessage("");
      setSelectedClients(new Set());
      setSelectAll(false);
      setScheduledDate("");
      loadScheduledDispatches();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao agendar");
    } finally {
      setScheduling(false);
    }
  };

  const handleCancelScheduled = async (id: string) => {
    try {
      const { error } = await supabase
        .from("disparos_programados")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Disparo cancelado");
      loadScheduledDispatches();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao cancelar");
    }
  };

  const handleExecuteNow = async (dispatch: ScheduledDispatch) => {
    const { data: config, error: configError } = await supabase
      .from("webhook_config")
      .select("disparo_webhook_url, disparo_ativo")
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (configError || !config?.disparo_webhook_url || !config?.disparo_ativo) {
      toast.error("Webhook não configurado");
      return;
    }

    try {
      const selectedClientsList = clients.filter(c => dispatch.contatos_ids.includes(c.id));
      
      const contatos = selectedClientsList.map((client) => ({
        cliente_id: client.id,
        cliente_nome: client.nome,
        cliente_telefone: client.telefone,
        cliente_telefone_whatsapp: formatPhoneForWhatsApp(client.telefone!),
        mensagem: dispatch.mensagem.replace("{nome}", client.nome)
      }));

      const response = await fetch(config.disparo_webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evento: "disparo_mensagem_lote",
          total_contatos: contatos.length,
          contatos: contatos,
          timestamp: new Date().toISOString()
        }),
      });

      if (response.ok) {
        await supabase
          .from("disparos_programados")
          .update({ 
            executado: true, 
            executado_em: new Date().toISOString(),
            resultado: { success: true, total: contatos.length }
          })
          .eq("id", dispatch.id);

        toast.success(`${contatos.length} mensagem(ns) enviada(s)`);
        loadScheduledDispatches();
      } else {
        toast.error("Erro ao executar");
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro ao executar disparo");
    }
  };

  const filteredClients = clients.filter(client =>
    client.nome.toLowerCase().includes(search.toLowerCase()) ||
    client.telefone?.includes(search)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Disparo de Mensagens</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Envie mensagens em massa via WhatsApp
          </p>
        </div>
        <Button 
          onClick={loadClients} 
          variant="outline" 
          size="sm" 
          disabled={loading}
          className="h-9"
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Coluna Esquerda - Lista de Clientes */}
        <div className="bg-card border border-border rounded-lg">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-sm">Clientes</span>
              </div>
              <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
                {selectedClients.size} selecionado(s)
              </span>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Buscar por nome ou telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>

          <div className="p-3">
            {/* Select All */}
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded mb-2">
              <Checkbox
                id="select-all"
                checked={selectAll}
                onCheckedChange={handleSelectAll}
              />
              <Label htmlFor="select-all" className="cursor-pointer text-sm">
                Selecionar todos ({filteredClients.length})
              </Label>
            </div>

            {/* Clients List */}
            {loading ? (
              <div className="py-12 text-center">
                <Loader2 className="w-5 h-5 text-muted-foreground animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Carregando...</p>
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum cliente encontrado</p>
              </div>
            ) : (
              <div className="max-h-[360px] overflow-y-auto space-y-1">
                {filteredClients.map((client) => (
                  <div
                    key={client.id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded cursor-pointer transition-colors",
                      selectedClients.has(client.id) 
                        ? "bg-primary/10" 
                        : "hover:bg-muted/50"
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
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Coluna Direita - Composição */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-lg">
            <div className="p-4 border-b border-border">
              <span className="font-medium text-sm">Mensagem</span>
            </div>

            <div className="p-4 space-y-4">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={`Olá {nome}!\n\nSua mensagem aqui...`}
                className="min-h-[140px] resize-none text-sm"
              />
              
              <p className="text-xs text-muted-foreground">
                Use <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{"{nome}"}</code> para personalizar
              </p>

              {/* Preview */}
              {message && (
                <div className="p-3 bg-muted/50 rounded border border-border">
                  <p className="text-xs text-muted-foreground mb-1.5">Prévia:</p>
                  <p className="text-sm whitespace-pre-wrap">
                    {message.replace("{nome}", "João Silva")}
                  </p>
                </div>
              )}

              {/* Botão Enviar */}
              <Button
                onClick={handleSendMessages}
                disabled={sending || selectedClients.size === 0 || !message.trim()}
                className="w-full h-10"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Enviar Agora ({selectedClients.size})
                  </>
                )}
              </Button>

              {/* Agendar */}
              <div className="pt-4 border-t border-border">
                <p className="text-sm font-medium mb-3">Agendar Envio</p>
                <div className="flex gap-2">
                  <Input
                    type="datetime-local"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="flex-1 h-9 text-sm"
                  />
                  <Button
                    onClick={handleScheduleDispatch}
                    disabled={scheduling || selectedClients.size === 0 || !message.trim() || !scheduledDate}
                    variant="outline"
                    size="sm"
                    className="h-9 px-4"
                  >
                    {scheduling ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Clock className="w-4 h-4 mr-1.5" />
                        Agendar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Disparos Agendados */}
          {scheduledDispatches.length > 0 && (
            <div className="bg-card border border-border rounded-lg">
              <div className="p-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Agendados ({scheduledDispatches.length})</span>
                </div>
              </div>
              
              <div className="p-3 space-y-2 max-h-[200px] overflow-y-auto">
                {scheduledDispatches.map((dispatch) => (
                  <div
                    key={dispatch.id}
                    className="flex items-center justify-between p-3 rounded bg-muted/50 border border-border"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium">
                          {format(new Date(dispatch.data_programada), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          • {dispatch.contatos_ids.length} contato(s)
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {dispatch.mensagem.substring(0, 50)}...
                      </p>
                    </div>
                    <div className="flex gap-1 ml-3">
                      <Button
                        onClick={() => handleExecuteNow(dispatch)}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="Executar agora"
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={() => handleCancelScheduled(dispatch.id)}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        title="Cancelar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
