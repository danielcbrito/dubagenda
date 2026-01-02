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
  Save,
  TestTube,
  Megaphone
} from "lucide-react";
import { cn } from "@/lib/utils";

interface WebhookConfig {
  id: string;
  webhook_url: string | null;
  ativo: boolean;
  whatsapp_webhook_url: string | null;
  whatsapp_ativo: boolean;
  disparo_webhook_url: string | null;
  disparo_ativo: boolean;
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
  const [disparoUrl, setDisparoUrl] = useState("");
  const [disparoAtivo, setDisparoAtivo] = useState(true);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      // IMPORTANTE: a tabela webhook_config já teve múltiplas linhas no passado.
      // Para evitar erro do PostgREST com .single(), pegamos SEMPRE a config mais recente.
      const { data, error } = await supabase
        .from('webhook_config')
        .select('id, webhook_url, ativo, whatsapp_webhook_url, whatsapp_ativo, disparo_webhook_url, disparo_ativo')
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig(data);
        setMainUrl(data.webhook_url || "");
        setMainAtivo(data.ativo ?? true);
        setWhatsappUrl(data.whatsapp_webhook_url || "");
        setWhatsappAtivo(data.whatsapp_ativo ?? true);
        setDisparoUrl(data.disparo_webhook_url || "");
        setDisparoAtivo(data.disparo_ativo ?? true);
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
    if (disparoUrl && !isValidUrl(disparoUrl)) {
      toast.error("URL do webhook de disparo inválida");
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
            disparo_webhook_url: disparoUrl || null,
            disparo_ativo: disparoAtivo,
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
            disparo_webhook_url: disparoUrl || null,
            disparo_ativo: disparoAtivo,
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

  const handleTest = async (type: "main" | "whatsapp" | "disparo") => {
    const url = type === "main" ? mainUrl : type === "whatsapp" ? whatsappUrl : disparoUrl;
    
    if (!url) {
      toast.error("Configure uma URL primeiro");
      return;
    }

    setTesting(type);
    try {
      const testPayload = type === "main" ? {
        evento: "teste_webhook",
        status: "ok",
        mensagem: "Teste do webhook principal configurado com sucesso",
        timestamp: new Date().toISOString()
      } : type === "whatsapp" ? {
        evento: "verificacao_cadastro",
        cliente_nome: "Teste Sistema",
        telefone: "5511999999999@s.whatsapp.net",
        codigo: "123456",
        mensagem: "Seu código de verificação é: 123456",
        timestamp: new Date().toISOString(),
        _teste: true,
      } : {
        evento: "disparo_mensagem",
        cliente_id: "teste-id",
        cliente_nome: "Cliente Teste",
        cliente_telefone: "11999999999",
        cliente_telefone_whatsapp: "5511999999999@s.whatsapp.net",
        mensagem: "Esta é uma mensagem de teste do sistema de disparo.",
        timestamp: new Date().toISOString(),
        _teste: true,
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload),
      });

      if (response.ok) {
        toast.success("Webhook testado com sucesso!");
      } else {
        toast.error(`Falha ao testar: HTTP ${response.status}`);
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
      subtitle: "Eventos de agendamentos, pagamentos e clientes",
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
      subtitle: "Verificação de cadastro via WhatsApp",
      icon: MessageCircle,
      color: "emerald",
      url: whatsappUrl,
      setUrl: setWhatsappUrl,
      ativo: whatsappAtivo,
      setAtivo: setWhatsappAtivo,
      events: [
        { name: "verificacao_cadastro", icon: MessageCircle },
      ]
    },
    {
      id: "disparo",
      title: "Webhook Disparo",
      subtitle: "Disparo de mensagens em massa do admin",
      icon: Megaphone,
      color: "amber",
      url: disparoUrl,
      setUrl: setDisparoUrl,
      ativo: disparoAtivo,
      setAtivo: setDisparoAtivo,
      events: [
        { name: "disparo_mensagem", icon: Send },
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
          className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
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
      <div className="grid gap-4">
        {webhookTypes.map((webhook) => {
          const Icon = webhook.icon;
          const isActive = webhook.ativo && webhook.url;
          const colorClasses = {
            blue: {
              bg: "bg-blue-500/5",
              iconBg: "bg-blue-500/10",
              iconText: "text-blue-400",
              text: "text-blue-400",
              tag: "bg-blue-500/10 text-blue-400"
            },
            emerald: {
              bg: "bg-emerald-500/5",
              iconBg: "bg-emerald-500/10",
              iconText: "text-emerald-400",
              text: "text-emerald-400",
              tag: "bg-emerald-500/10 text-emerald-400"
            },
            amber: {
              bg: "bg-amber-500/5",
              iconBg: "bg-amber-500/10",
              iconText: "text-amber-400",
              text: "text-amber-400",
              tag: "bg-amber-500/10 text-amber-400"
            }
          };
          const colors = colorClasses[webhook.color as keyof typeof colorClasses];
          
          return (
            <div 
              key={webhook.id}
              className="bg-[#0d1117] border border-[#2a3142] rounded-lg overflow-hidden"
            >
              {/* Card Header */}
              <div className={cn(
                "px-4 py-3 border-b border-[#2a3142] flex items-center gap-3",
                colors.bg
              )}>
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center",
                  colors.iconBg
                )}>
                  <Icon className={cn("w-4 h-4", colors.iconText)} />
                </div>
                <div className="flex-1">
                  <p className={cn("text-sm font-semibold", colors.text)}>{webhook.title}</p>
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

                {/* Status Toggle & Test */}
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
                    onClick={() => handleTest(webhook.id as "main" | "whatsapp" | "disparo")}
                    disabled={testing === webhook.id || !webhook.url}
                    className="h-7 px-3 text-[11px] border-[#2a3142]"
                  >
                    {testing === webhook.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <><TestTube className="w-3 h-3 mr-1" /> Testar</>
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
                            colors.tag
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

      {/* Payload Info Card */}
      <div className="bg-[#0d1117] border border-[#2a3142] rounded-lg overflow-hidden">
        <div className="bg-[#161b22] px-4 py-2 border-b border-[#2a3142] flex items-center gap-2">
          <Info className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
            Formato dos Payloads
          </span>
        </div>
        
        <div className="p-4 grid gap-4 lg:grid-cols-3">
          {/* Main Webhook Payload */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-blue-400">Webhook Principal</p>
            <pre className="p-3 bg-[#161b22] border border-[#2a3142] rounded-lg text-[10px] text-gray-400 overflow-x-auto">
{`{
  "evento": "agendamento_criado",
  "cliente_nome": "João",
  "cliente_telefone_whatsapp": 
    "5511999999999@s.whatsapp.net",
  "data": "2025-01-15",
  "hora": "14:30",
  "servico": "Corte Degradê",
  "preco": 45.00,
  "mensagem": "Olá João!..."
}`}
            </pre>
          </div>

          {/* WhatsApp Webhook Payload */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-emerald-400">Webhook WhatsApp</p>
            <pre className="p-3 bg-[#161b22] border border-[#2a3142] rounded-lg text-[10px] text-gray-400 overflow-x-auto">
{`{
  "evento": "verificacao_cadastro",
  "cliente_nome": "João",
  "telefone": 
    "5511999999999@s.whatsapp.net",
  "codigo": "483920",
  "mensagem": "Seu código: 483920"
}`}
            </pre>
          </div>

          {/* Disparo Webhook Payload */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-amber-400">Webhook Disparo</p>
            <pre className="p-3 bg-[#161b22] border border-[#2a3142] rounded-lg text-[10px] text-gray-400 overflow-x-auto">
{`{
  "evento": "disparo_mensagem",
  "cliente_id": "uuid",
  "cliente_nome": "João",
  "cliente_telefone": "11999999999",
  "cliente_telefone_whatsapp": 
    "5511999999999@s.whatsapp.net",
  "mensagem": "Olá João!..."
}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}