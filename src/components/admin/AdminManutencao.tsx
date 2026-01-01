import { useState, useEffect } from "react";
import { Wrench, AlertTriangle, Loader2, Calendar, Clock, Bell } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MaintenanceConfig {
  id: string;
  manutencao_ativa: boolean;
  manutencao_mensagem: string | null;
  manutencao_inicio_programada: string | null;
  manutencao_fim_programada: string | null;
  manutencao_aviso_ativo: boolean;
  manutencao_aviso_mensagem: string | null;
}

export function AdminManutencao() {
  const [config, setConfig] = useState<MaintenanceConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingToggle, setPendingToggle] = useState(false);
  const [message, setMessage] = useState("");
  
  // Manutenção programada
  const [scheduledStart, setScheduledStart] = useState("");
  const [scheduledEnd, setScheduledEnd] = useState("");
  
  // Aviso prévio
  const [warningActive, setWarningActive] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("webhook_config")
        .select("id, manutencao_ativa, manutencao_mensagem, manutencao_inicio_programada, manutencao_fim_programada, manutencao_aviso_ativo, manutencao_aviso_mensagem")
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const configData = data as MaintenanceConfig;
        setConfig(configData);
        setMessage(configData.manutencao_mensagem || "Estamos realizando melhorias para você. Voltamos em breve!");
        
        // Manutenção programada
        if (configData.manutencao_inicio_programada) {
          setScheduledStart(formatDateTimeLocal(configData.manutencao_inicio_programada));
        }
        if (configData.manutencao_fim_programada) {
          setScheduledEnd(formatDateTimeLocal(configData.manutencao_fim_programada));
        }
        
        // Aviso
        setWarningActive(configData.manutencao_aviso_ativo || false);
        setWarningMessage(configData.manutencao_aviso_mensagem || "");
      }
    } catch (error) {
      console.error("Error loading config:", error);
      toast.error("Erro ao carregar configurações");
    } finally {
      setIsLoading(false);
    }
  };

  const formatDateTimeLocal = (isoString: string) => {
    const date = new Date(isoString);
    return format(date, "yyyy-MM-dd'T'HH:mm");
  };

  const handleToggleChange = (checked: boolean) => {
    if (checked) {
      setPendingToggle(true);
      setShowConfirmDialog(true);
    } else {
      saveMaintenanceActive(false);
    }
  };

  const confirmActivation = async () => {
    setShowConfirmDialog(false);
    await saveMaintenanceActive(true);
    setPendingToggle(false);
  };

  const cancelActivation = () => {
    setShowConfirmDialog(false);
    setPendingToggle(false);
  };

  const saveMaintenanceActive = async (maintenanceActive: boolean) => {
    if (!config) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("webhook_config")
        .update({
          manutencao_ativa: maintenanceActive,
          manutencao_mensagem: message,
          updated_at: new Date().toISOString()
        })
        .eq("id", config.id);

      if (error) throw error;

      setConfig(prev => prev ? { ...prev, manutencao_ativa: maintenanceActive } : null);
      
      if (maintenanceActive) {
        toast.success("🔧 Modo manutenção ATIVADO! Todos os usuários verão a tela de manutenção.");
      } else {
        toast.success("✅ Modo manutenção DESATIVADO! O app voltou ao normal.");
      }
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setIsSaving(false);
    }
  };

  const saveMessage = async () => {
    if (!config) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("webhook_config")
        .update({
          manutencao_mensagem: message,
          updated_at: new Date().toISOString()
        })
        .eq("id", config.id);

      if (error) throw error;

      toast.success("Mensagem de manutenção atualizada!");
    } catch (error) {
      console.error("Error saving message:", error);
      toast.error("Erro ao salvar mensagem");
    } finally {
      setIsSaving(false);
    }
  };

  const saveScheduledMaintenance = async () => {
    if (!config) return;

    setIsSaving(true);
    try {
      const startDate = scheduledStart ? new Date(scheduledStart).toISOString() : null;
      const endDate = scheduledEnd ? new Date(scheduledEnd).toISOString() : null;

      if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
        toast.error("A data de fim deve ser depois da data de início");
        setIsSaving(false);
        return;
      }

      const { error } = await supabase
        .from("webhook_config")
        .update({
          manutencao_inicio_programada: startDate,
          manutencao_fim_programada: endDate,
          updated_at: new Date().toISOString()
        })
        .eq("id", config.id);

      if (error) throw error;

      setConfig(prev => prev ? { 
        ...prev, 
        manutencao_inicio_programada: startDate,
        manutencao_fim_programada: endDate
      } : null);
      
      if (startDate && endDate) {
        toast.success("📅 Manutenção programada salva!");
      } else {
        toast.success("Manutenção programada removida");
      }
    } catch (error) {
      console.error("Error saving scheduled maintenance:", error);
      toast.error("Erro ao salvar manutenção programada");
    } finally {
      setIsSaving(false);
    }
  };

  const clearScheduledMaintenance = async () => {
    setScheduledStart("");
    setScheduledEnd("");
    if (!config) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("webhook_config")
        .update({
          manutencao_inicio_programada: null,
          manutencao_fim_programada: null,
          updated_at: new Date().toISOString()
        })
        .eq("id", config.id);

      if (error) throw error;

      setConfig(prev => prev ? { 
        ...prev, 
        manutencao_inicio_programada: null,
        manutencao_fim_programada: null
      } : null);
      
      toast.success("Manutenção programada removida");
    } catch (error) {
      console.error("Error clearing scheduled maintenance:", error);
      toast.error("Erro ao limpar manutenção programada");
    } finally {
      setIsSaving(false);
    }
  };

  const saveWarning = async () => {
    if (!config) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("webhook_config")
        .update({
          manutencao_aviso_ativo: warningActive,
          manutencao_aviso_mensagem: warningMessage || null,
          updated_at: new Date().toISOString()
        })
        .eq("id", config.id);

      if (error) throw error;

      setConfig(prev => prev ? { 
        ...prev, 
        manutencao_aviso_ativo: warningActive,
        manutencao_aviso_mensagem: warningMessage
      } : null);
      
      toast.success(warningActive ? "🔔 Aviso de manutenção ativado!" : "Aviso de manutenção salvo");
    } catch (error) {
      console.error("Error saving warning:", error);
      toast.error("Erro ao salvar aviso");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6 card-glass">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Modo Manutenção Imediato */}
      <Card className="p-6 card-glass">
        <div className="flex items-center gap-3 mb-6">
          <div className={`p-2 rounded-lg ${config?.manutencao_ativa ? 'bg-destructive/20' : 'bg-primary/20'}`}>
            <Wrench className={`w-5 h-5 ${config?.manutencao_ativa ? 'text-destructive' : 'text-primary'}`} />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Modo Manutenção Imediato</h3>
            <p className="text-xs text-muted-foreground">
              Bloqueia o acesso imediatamente
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Toggle */}
          <div className={`flex items-center justify-between p-4 rounded-xl border ${
            config?.manutencao_ativa 
              ? 'bg-destructive/10 border-destructive/30' 
              : 'bg-secondary/50 border-border'
          }`}>
            <div className="flex items-center gap-3">
              {config?.manutencao_ativa && (
                <AlertTriangle className="w-5 h-5 text-destructive animate-pulse" />
              )}
              <div>
                <p className="font-medium">
                  {config?.manutencao_ativa ? "Manutenção ATIVA" : "Manutenção desativada"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {config?.manutencao_ativa 
                    ? "Nenhum usuário consegue acessar o app agora" 
                    : "O app está funcionando normalmente"
                  }
                </p>
              </div>
            </div>
            <Switch
              checked={config?.manutencao_ativa || false}
              onCheckedChange={handleToggleChange}
              disabled={isSaving}
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="maintenance-message">Mensagem de manutenção</Label>
            <Textarea
              id="maintenance-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Digite a mensagem que será exibida aos usuários..."
              className="min-h-[100px] input-glass"
            />
            <Button
              onClick={saveMessage}
              disabled={isSaving}
              variant="outline"
              size="sm"
              className="mt-2"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Salvar mensagem
            </Button>
          </div>
        </div>
      </Card>

      {/* Manutenção Programada */}
      <Card className="p-6 card-glass">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-blue-500/20">
            <Calendar className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Manutenção Programada</h3>
            <p className="text-xs text-muted-foreground">
              Agende um período de manutenção automática
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scheduled-start" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Início da manutenção
              </Label>
              <Input
                id="scheduled-start"
                type="datetime-local"
                value={scheduledStart}
                onChange={(e) => setScheduledStart(e.target.value)}
                className="input-glass"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduled-end" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Fim da manutenção
              </Label>
              <Input
                id="scheduled-end"
                type="datetime-local"
                value={scheduledEnd}
                onChange={(e) => setScheduledEnd(e.target.value)}
                className="input-glass"
              />
            </div>
          </div>

          {config?.manutencao_inicio_programada && config?.manutencao_fim_programada && (
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <p className="text-sm text-blue-400">
                📅 Manutenção programada de{" "}
                <strong>
                  {format(new Date(config.manutencao_inicio_programada), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </strong>
                {" "}até{" "}
                <strong>
                  {format(new Date(config.manutencao_fim_programada), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </strong>
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={saveScheduledMaintenance}
              disabled={isSaving || (!scheduledStart && !scheduledEnd)}
              size="sm"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Salvar agendamento
            </Button>
            {(scheduledStart || scheduledEnd || config?.manutencao_inicio_programada) && (
              <Button
                onClick={clearScheduledMaintenance}
                disabled={isSaving}
                variant="outline"
                size="sm"
              >
                Limpar
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Aviso Prévio */}
      <Card className="p-6 card-glass">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-gold/20">
            <Bell className="w-5 h-5 text-gold" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Aviso Prévio de Manutenção</h3>
            <p className="text-xs text-muted-foreground">
              Exibe um banner de aviso para os usuários
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className={`flex items-center justify-between p-4 rounded-xl border ${
            warningActive 
              ? 'bg-gold/10 border-gold/30' 
              : 'bg-secondary/50 border-border'
          }`}>
            <div>
              <p className="font-medium">
                {warningActive ? "Aviso ATIVO" : "Aviso desativado"}
              </p>
              <p className="text-xs text-muted-foreground">
                {warningActive 
                  ? "Usuários verão o aviso ao usar o app" 
                  : "Nenhum aviso será exibido"
                }
              </p>
            </div>
            <Switch
              checked={warningActive}
              onCheckedChange={setWarningActive}
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="warning-message">Mensagem do aviso</Label>
            <Textarea
              id="warning-message"
              value={warningMessage}
              onChange={(e) => setWarningMessage(e.target.value)}
              placeholder="Ex: Manutenção programada para domingo às 03:00..."
              className="min-h-[80px] input-glass"
            />
          </div>

          <Button
            onClick={saveWarning}
            disabled={isSaving}
            size="sm"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Salvar aviso
          </Button>
        </div>
      </Card>

      {/* Warning */}
      <Card className="p-4 bg-gold/10 border-gold/30">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-gold shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-gold mb-1">Atenção</p>
            <p className="text-muted-foreground">
              Quando o modo manutenção estiver ativo (manual ou programado), <strong>todos os usuários</strong> serão 
              bloqueados de acessar o app. Apenas administradores podem ver o painel admin.
            </p>
          </div>
        </div>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="card-glass">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Ativar modo manutenção?
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong className="text-destructive">Atenção!</strong> Ao ativar o modo manutenção, 
              <strong> todos os usuários</strong> serão impedidos de acessar o aplicativo.
              <br /><br />
              Apenas administradores poderão acessar o painel de controle.
              <br /><br />
              Tem certeza que deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelActivation}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmActivation}
              className="bg-destructive hover:bg-destructive/90"
            >
              Sim, ativar manutenção
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
