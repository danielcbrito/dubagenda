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
              <CardTitle className="text-base">Eventos Enviados</CardTitle>
              <CardDescription>
                O sistema enviará os seguintes eventos para seu webhook
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <EventCard 
              evento="novo_agendamento" 
              desc="Quando um cliente cria um novo agendamento" 
            />
            <EventCard 
              evento="agendamento_confirmado" 
              desc="Quando o barbeiro confirma um agendamento" 
            />
            <EventCard 
              evento="pagamento_realizado" 
              desc="Quando um pagamento é confirmado" 
            />
            <EventCard 
              evento="agendamento_cancelado" 
              desc="Quando um agendamento é cancelado" 
            />
            <EventCard 
              evento="remarcacao_solicitada" 
              desc="Quando o barbeiro solicita remarcação" 
            />
            <EventCard 
              evento="remarcacao_concluida" 
              desc="Quando o cliente conclui a remarcação" 
            />
          </div>

          <div className="mt-4 p-4 rounded-lg bg-muted/30">
            <p className="text-sm font-medium mb-2">Formato do Payload:</p>
            <pre className="text-xs text-muted-foreground overflow-x-auto">
{`{
  "evento": "tipo_do_evento",
  "agendamento_id": "uuid",
  "cliente_id": "uuid",
  "cliente_nome": "Nome do Cliente",
  "cliente_telefone": "11999999999",
  "servico": "Nome do Serviço",
  "data": "2025-12-04",
  "hora": "10:00",
  "preco": 50.00,
  "status": "status_atual",
  "mensagem_barbeiro": "...",
  "timestamp": "2025-12-04T10:00:00Z"
}`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EventCard({ evento, desc }: { evento: string; desc: string }) {
  return (
    <div className="p-3 rounded-lg bg-muted/20 border border-border/30">
      <code className="text-xs font-mono text-primary">{evento}</code>
      <p className="text-xs text-muted-foreground mt-1">{desc}</p>
    </div>
  );
}

export default AdminWebhook;
