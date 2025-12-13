import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Webhook, Send, CheckCircle2, XCircle, Info } from "lucide-react";

export function AdminWebhook() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('webhook_config')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setWebhookUrl(data.webhook_url || "");
        setAtivo(data.ativo ?? true);
        setConfigId(data.id);
      }
    } catch (error) {
      console.error('Erro ao carregar config:', error);
      toast.error("Erro ao carregar configuração do webhook");
    } finally {
      setLoading(false);
    }
  };

  const isValidUrl = (url: string) => {
    if (!url) return true;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSave = async () => {
    if (webhookUrl && !isValidUrl(webhookUrl)) {
      toast.error("URL inválida. Verifique o formato.");
      return;
    }

    setSaving(true);
    try {
      if (configId) {
        const { error } = await supabase
          .from('webhook_config')
          .update({ 
            webhook_url: webhookUrl || null, 
            ativo 
          })
          .eq('id', configId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('webhook_config')
          .insert({ 
            webhook_url: webhookUrl || null, 
            ativo 
          })
          .select()
          .single();

        if (error) throw error;
        setConfigId(data.id);
      }

      toast.success("Configuração salva com sucesso!");
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error("Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!webhookUrl) {
      toast.error("Configure uma URL de webhook primeiro");
      return;
    }

    if (!isValidUrl(webhookUrl)) {
      toast.error("URL inválida. Verifique o formato.");
      return;
    }

    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-webhook-event', {
        body: {
          evento: "teste_webhook",
          status: "ok",
          mensagem: "Webhook configurado com sucesso",
          timestamp: new Date().toISOString()
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("Webhook testado com sucesso! Evento enviado.");
      } else {
        toast.error(data?.error || "Falha ao testar webhook");
      }
    } catch (error) {
      console.error('Erro ao testar:', error);
      toast.error("Erro ao testar webhook. Verifique a URL e tente novamente.");
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Webhook className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle>Configuração de Webhook</CardTitle>
              <CardDescription>
                Configure a URL do webhook para receber eventos do sistema em tempo real
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* URL do Webhook */}
          <div className="space-y-2">
            <Label htmlFor="webhook-url">URL do Webhook</Label>
            <Input
              id="webhook-url"
              type="url"
              placeholder="https://seu-n8n.app.n8n.cloud/webhook/..."
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className={!isValidUrl(webhookUrl) ? "border-destructive" : ""}
            />
            {webhookUrl && !isValidUrl(webhookUrl) && (
              <p className="text-sm text-destructive">URL inválida</p>
            )}
            <p className="text-sm text-muted-foreground">
              Cole aqui a URL do webhook do n8n ou outro serviço de automação
            </p>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div className="flex items-center gap-3">
              <Switch
                id="webhook-ativo"
                checked={ativo}
                onCheckedChange={setAtivo}
              />
              <Label htmlFor="webhook-ativo" className="cursor-pointer">
                Webhook Ativo
              </Label>
            </div>
            <Badge variant={ativo && webhookUrl ? "default" : "secondary"}>
              {ativo && webhookUrl ? (
                <><CheckCircle2 className="w-3 h-3 mr-1" /> Ativo</>
              ) : (
                <><XCircle className="w-3 h-3 mr-1" /> Inativo</>
              )}
            </Badge>
          </div>

          {/* Botões */}
          <div className="flex gap-3">
            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="flex-1"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</>
              ) : (
                "Salvar Configuração"
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={handleTest}
              disabled={testing || !webhookUrl}
            >
              {testing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Testando...</>
              ) : (
                <><Send className="w-4 h-4 mr-2" /> Testar Webhook</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Card de Informações sobre Eventos */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Info className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <CardTitle className="text-base">Todos os Eventos Enviados</CardTitle>
              <CardDescription>
                Este webhook único recebe TODOS os eventos do sistema em tempo real
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Eventos de Agendamento */}
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-primary mb-2">Agendamentos</h4>
            <div className="grid gap-2 sm:grid-cols-2">
              <EventCard evento="agendamento_criado" desc="Cliente criou novo agendamento" />
              <EventCard evento="agendamento_confirmado" desc="Barbeiro confirmou agendamento" />
              <EventCard evento="agendamento_cancelado" desc="Agendamento cancelado" />
              <EventCard evento="remarcacao_solicitada" desc="Barbeiro solicitou remarcação" />
              <EventCard evento="remarcacao_concluida" desc="Cliente concluiu remarcação" />
              <EventCard evento="horario_atualizado" desc="Horário do agendamento alterado" />
            </div>
          </div>

          {/* Eventos de Atendimento */}
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-primary mb-2">Atendimento</h4>
            <div className="grid gap-2 sm:grid-cols-2">
              <EventCard evento="atendimento_iniciado" desc="Barbeiro iniciou atendimento" />
              <EventCard evento="atendimento_finalizado" desc="Atendimento concluído" />
              <EventCard evento="cliente_aguardando" desc="Cliente aguardando atendimento" />
              <EventCard evento="cliente_nao_compareceu" desc="Cliente não compareceu (no-show)" />
              <EventCard evento="status_alterado" desc="Status do agendamento alterado" />
            </div>
          </div>

          {/* Eventos de Pagamento */}
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-primary mb-2">Pagamentos</h4>
            <div className="grid gap-2 sm:grid-cols-2">
              <EventCard evento="pagamento_realizado" desc="Pagamento confirmado" />
              <EventCard evento="pagamento_parcial_credito" desc="Pagamento parcial com créditos" />
              <EventCard evento="pagamento_creditos" desc="Pago integralmente com créditos" />
            </div>
          </div>

          {/* Eventos de Créditos */}
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-primary mb-2">Créditos</h4>
            <div className="grid gap-2 sm:grid-cols-2">
              <EventCard evento="credito_adicionado" desc="Crédito adicionado à carteira" />
              <EventCard evento="credito_usado" desc="Cliente usou créditos" />
              <EventCard evento="credito_estornado" desc="Crédito devolvido (cancelamento)" />
            </div>
          </div>

          {/* Eventos de Verificação */}
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-green-500 mb-2">Verificação WhatsApp</h4>
            <div className="grid gap-2 sm:grid-cols-2">
              <EventCard evento="verificacao_cadastro" desc="Enviar código de verificação para WhatsApp" />
            </div>
          </div>

          {/* Eventos de Cliente */}
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-primary mb-2">Clientes</h4>
            <div className="grid gap-2 sm:grid-cols-2">
              <EventCard evento="cliente_criado" desc="Novo cliente cadastrado" />
              <EventCard evento="cliente_atualizado" desc="Dados do cliente atualizados" />
            </div>
          </div>

          {/* Formato do Payload - Agendamentos */}
          <div className="mt-4 p-4 rounded-lg bg-muted/30">
            <p className="text-sm font-medium mb-2">Formato do Payload (Agendamentos):</p>
            <pre className="text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap">
{`{
  "evento": "agendamento_criado",
  "evento_id": "uuid-unico-do-evento",
  "timestamp": "2025-12-06T10:00:00Z",
  "agendamento_id": "uuid",
  "data": "2025-12-06",
  "hora": "10:00",
  "servico": "Corte + Barba",
  "valor_total": 50.00,
  "cliente_id": "uuid",
  "cliente_nome": "João Silva",
  "cliente_telefone": "11999999999",
  "cliente_email": "joao@email.com",
  "barbeiro_nome": "Carlos"
}`}
            </pre>
          </div>

          {/* Formato do Payload - Verificação WhatsApp */}
          <div className="mt-4 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
            <p className="text-sm font-medium mb-2 text-green-400">Formato do Payload (Verificação WhatsApp):</p>
            <pre className="text-xs text-green-300/80 overflow-x-auto whitespace-pre-wrap">
{`{
  "evento": "verificacao_cadastro",
  "cliente_nome": "João Silva",
  "telefone": "5511999999999@s.whatsapp.net",
  "codigo": "483920",
  "timestamp": "2025-12-06T10:00:00Z"
}`}
            </pre>
            <p className="text-xs text-green-400/80 mt-2">
              <strong>Nota:</strong> O telefone sempre está no formato WhatsApp (55 + DDD + número + @s.whatsapp.net).
              Use este payload para enviar o código de verificação via n8n para o WhatsApp do cliente.
            </p>
          </div>

          <div className="mt-4 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-xs text-primary">
              <strong>Importante:</strong> Configure este webhook no seu n8n para receber todos os eventos do sistema.
              O evento "verificacao_cadastro" é usado para confirmar novos cadastros via WhatsApp.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EventCard({ evento, desc }: { evento: string; desc: string }) {
  return (
    <div className="p-2 rounded-lg bg-muted/20 border border-border/30">
      <code className="text-xs font-mono text-primary">{evento}</code>
      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
    </div>
  );
}

export default AdminWebhook;
