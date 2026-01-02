import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Webhook, 
  Send, 
  CheckCircle, 
  XCircle, 
  Loader2,
  MessageCircle,
  Bell,
  Calendar,
  CreditCard,
  Info,
  Save
} from "lucide-react";
import { cn } from "@/lib/utils";

interface WebhookConfig {
  id: string;
  webhook_url: string | null;
  ativo: boolean;
  whatsapp_webhook_url: string | null;
  whatsapp_ativo: boolean;
}

export function TIWebhooks() {
  const [config, setConfig] = useState<WebhookConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  // Form state
  const [mainUrl, setMainUrl] = useState("");
  const [mainAtivo, setMainAtivo] = useState(true);
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [whatsappAtivo, setWhatsappAtivo] = useState(true);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('webhook_config')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setConfig(data);
        setMainUrl(data.webhook_url || "");
        setMainAtivo(data.ativo ?? true);
        setWhatsappUrl(data.whatsapp_webhook_url || "");
        setWhatsappAtivo(data.whatsapp_ativo ?? true);
      }
    } catch (error) {
      console.error('Erro ao carregar config:', error);
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
    if (mainUrl && !isValidUrl(mainUrl)) {
      toast.error("URL do webhook principal inválida");
      return;
    }
    if (whatsappUrl && !isValidUrl(whatsappUrl)) {
      toast.error("URL do webhook WhatsApp inválida");
      return;
    }

    setSaving(true);
    try {
      if (config?.id) {
        const { error } = await supabase
          .from('webhook_config')
          .update({ 
            webhook_url: mainUrl || null, 
            ativo: mainAtivo,
            whatsapp_webhook_url: whatsappUrl || null,
            whatsapp_ativo: whatsappAtivo,
          })
          .eq('id', config.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('webhook_config')
          .insert({ 
            webhook_url: mainUrl || null, 
            ativo: mainAtivo,
            whatsapp_webhook_url: whatsappUrl || null,
            whatsapp_ativo: whatsappAtivo,
          })
          .select()
          .single();

        if (error) throw error;
        setConfig(data);
      }

      toast.success("Configurações salvas com sucesso!");
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (type: "main" | "whatsapp") => {
    const url = type === "main" ? mainUrl : whatsappUrl;
    
    if (!url) {
      toast.error("Configure uma URL primeiro");
      return;
    }

    setTesting(type);
    try {
      if (type === "main") {
        const { data, error } = await supabase.functions.invoke('send-webhook-event', {
          body: {
            evento: "teste_webhook",
            status: "ok",
            mensagem: "Teste do webhook configurado com sucesso",
            timestamp: new Date().toISOString()
          }
        });

        if (error) throw error;
        if (data?.success) {
          toast.success("Webhook testado com sucesso!");
        } else {
          toast.error(data?.error || "Falha ao testar webhook");
        }
      } else {
        const response = await fetch(whatsappUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            evento: "teste_verificacao",
            cliente_nome: "Teste Sistema",
            telefone: "5511999999999@s.whatsapp.net",
            codigo: "123456",
            timestamp: new Date().toISOString(),
            _teste: true,
          }),
        });

        if (response.ok) {
          toast.success("Webhook WhatsApp testado com sucesso!");
        } else {
          toast.error(`Falha ao testar: HTTP ${response.status}`);
        }
      }
    } catch (error) {
      console.error('Erro ao testar:', error);
      toast.error("Erro ao testar webhook");
    } finally {
      setTesting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    );
  }

  const webhookTypes = [
    {
      id: "main",
      title: "Webhook Principal",
      subtitle: "Eventos gerais do sistema",
      icon: Webhook,
      color: "blue",
      url: mainUrl,
      setUrl: setMainUrl,
      ativo: mainAtivo,
      setAtivo: setMainAtivo,
      events: [
        { name: "agendamento_criado", icon: Calendar },
        { name: "agendamento_confirmado", icon: CheckCircle },
        { name: "agendamento_cancelado", icon: XCircle },
        { name: "pagamento_realizado", icon: CreditCard },
        { name: "cliente_criado", icon: Bell },
      ]
    },
    {
      id: "whatsapp",
      title: "Webhook WhatsApp",
      subtitle: "Verificação de cadastro",
      icon: MessageCircle,
      color: "emerald",
      url: whatsappUrl,
      setUrl: setWhatsappUrl,
      ativo: whatsappAtivo,
      setAtivo: setWhatsappAtivo,
      events: [
        { name: "verificacao_cadastro", icon: MessageCircle },
      ]
    }
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-gradient-to-r from-[#1e3a5f] to-[#2a4a6f] -mx-6 lg:-mx-8 -mt-6 lg:-mt-8 px-6 lg:px-8 py-3 border-b border-[#2a3142]">
        <div>
          <h1 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
            <Webhook className="w-5 h-5" />
            CONFIGURAÇÃO DE WEBHOOKS
          </h1>
          <p className="text-[11px] text-blue-200/70 mt-0.5">
            Gerencie as integrações com n8n e outros serviços
          </p>
        </div>
        <Button 
          onClick={handleSave}
          disabled={saving}
          size="sm"
          className="h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5"
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          Salvar Tudo
        </Button>
      </div>

      {/* Webhook Cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        {webhookTypes.map((webhook) => {
          const Icon = webhook.icon;
          const isActive = webhook.ativo && webhook.url;
          
          return (
            <div 
              key={webhook.id}
              className="bg-[#0d1117] border border-[#2a3142] rounded-lg overflow-hidden"
            >
              {/* Card Header */}
              <div className={cn(
                "px-4 py-3 border-b border-[#2a3142] flex items-center gap-3",
                webhook.color === "emerald" ? "bg-emerald-500/5" : "bg-blue-500/5"
              )}>
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center",
                  webhook.color === "emerald" ? "bg-emerald-500/10" : "bg-blue-500/10"
                )}>
                  <Icon className={cn(
                    "w-4 h-4",
                    webhook.color === "emerald" ? "text-emerald-400" : "text-blue-400"
                  )} />
                </div>
                <div className="flex-1">
                  <p className={cn(
                    "text-sm font-semibold",
                    webhook.color === "emerald" ? "text-emerald-400" : "text-blue-400"
                  )}>{webhook.title}</p>
                  <p className="text-[10px] text-gray-500">{webhook.subtitle}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    isActive ? "bg-emerald-500" : "bg-gray-600"
                  )} />
                  <span className="text-[10px] text-gray-500">
                    {isActive ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </div>

              {/* Card Content */}
              <div className="p-4 space-y-4">
                {/* URL Input */}
                <div className="space-y-2">
                  <Label className="text-xs text-gray-400">URL do Webhook</Label>
                  <Input
                    type="url"
                    placeholder="https://seu-n8n.app.n8n.cloud/webhook/..."
                    value={webhook.url}
                    onChange={(e) => webhook.setUrl(e.target.value)}
                    className={cn(
                      "h-9 bg-[#161b22] border-[#2a3142] text-sm",
                      !isValidUrl(webhook.url) && "border-red-500"
                    )}
                  />
                </div>

                {/* Status Toggle */}
                <div className="flex items-center justify-between p-3 bg-[#161b22] border border-[#2a3142] rounded-lg">
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`${webhook.id}-ativo`}
                      checked={webhook.ativo}
                      onCheckedChange={webhook.setAtivo}
                    />
                    <Label 
                      htmlFor={`${webhook.id}-ativo`} 
                      className="text-xs text-gray-400 cursor-pointer"
                    >
                      Webhook Ativo
                    </Label>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTest(webhook.id as "main" | "whatsapp")}
                    disabled={testing === webhook.id || !webhook.url}
                    className="h-7 px-3 text-[11px] border-[#2a3142]"
                  >
                    {testing === webhook.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <><Send className="w-3 h-3 mr-1" /> Testar</>
                    )}
                  </Button>
                </div>

                {/* Events List */}
                <div className="p-3 bg-[#161b22] border border-[#2a3142] rounded-lg">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
                    Eventos Suportados
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {webhook.events.map((event) => {
                      const EventIcon = event.icon;
                      return (
                        <span 
                          key={event.name}
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-1 rounded text-[10px]",
                            webhook.color === "emerald" 
                              ? "bg-emerald-500/10 text-emerald-400" 
                              : "bg-blue-500/10 text-blue-400"
                          )}
                        >
                          <EventIcon className="w-2.5 h-2.5" />
                          {event.name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info Card */}
      <div className="bg-[#0d1117] border border-[#2a3142] rounded-lg overflow-hidden">
        <div className="bg-[#161b22] px-4 py-2 border-b border-[#2a3142] flex items-center gap-2">
          <Info className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
            Formato dos Payloads
          </span>
        </div>
        
        <div className="p-4 grid gap-4 lg:grid-cols-2">
          {/* Main Webhook Payload */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-blue-400">Webhook Principal (Agendamentos)</p>
            <pre className="p-3 bg-[#161b22] border border-[#2a3142] rounded-lg text-[10px] text-gray-400 overflow-x-auto">
{`{
  "evento": "agendamento_criado",
  "cliente_nome": "João Silva",
  "cliente_telefone_whatsapp": "5511999999999@s.whatsapp.net",
  "data": "2025-01-15",
  "hora": "14:30",
  "servico": "Corte Degradê",
  "preco": 45.00,
  "mensagem": "Olá João! Seu agendamento foi confirmado para 15/01 às 14:30. Serviço: Corte Degradê. Valor: R$ 45,00. Aguardamos você!"
}`}
            </pre>
          </div>

          {/* WhatsApp Webhook Payload */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-emerald-400">Webhook WhatsApp (Verificação)</p>
            <pre className="p-3 bg-[#161b22] border border-[#2a3142] rounded-lg text-[10px] text-gray-400 overflow-x-auto">
{`{
  "evento": "verificacao_cadastro",
  "cliente_nome": "João Silva",
  "telefone": "5511999999999@s.whatsapp.net",
  "codigo": "483920",
  "mensagem": "Olá João! Seu código de verificação é 483920. Válido por 5 minutos."
}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
