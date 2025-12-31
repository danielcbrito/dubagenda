import { useState, useEffect } from "react";
import { Wrench, AlertTriangle, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
}

export function AdminManutencao() {
  const [config, setConfig] = useState<MaintenanceConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingToggle, setPendingToggle] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("webhook_config")
        .select("id, manutencao_ativa, manutencao_mensagem")
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const configData = data as MaintenanceConfig;
        setConfig(configData);
        setMessage(configData.manutencao_mensagem || "Estamos realizando melhorias para você. Voltamos em breve!");
      }
    } catch (error) {
      console.error("Error loading config:", error);
      toast.error("Erro ao carregar configurações");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleChange = (checked: boolean) => {
    if (checked) {
      // Ativando manutenção - mostrar confirmação
      setPendingToggle(true);
      setShowConfirmDialog(true);
    } else {
      // Desativando - executar direto
      saveConfig(false);
    }
  };

  const confirmActivation = async () => {
    setShowConfirmDialog(false);
    await saveConfig(true);
    setPendingToggle(false);
  };

  const cancelActivation = () => {
    setShowConfirmDialog(false);
    setPendingToggle(false);
  };

  const saveConfig = async (maintenanceActive: boolean) => {
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
    <>
      <Card className="p-6 card-glass">
        <div className="flex items-center gap-3 mb-6">
          <div className={`p-2 rounded-lg ${config?.manutencao_ativa ? 'bg-destructive/20' : 'bg-primary/20'}`}>
            <Wrench className={`w-5 h-5 ${config?.manutencao_ativa ? 'text-destructive' : 'text-primary'}`} />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Modo Manutenção</h3>
            <p className="text-xs text-muted-foreground">
              Bloqueia o acesso de todos os usuários ao app
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
            <p className="text-xs text-muted-foreground">
              Esta mensagem será exibida na tela de manutenção para todos os usuários.
            </p>
            <Button
              onClick={saveMessage}
              disabled={isSaving}
              variant="outline"
              size="sm"
              className="mt-2"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Salvar mensagem
            </Button>
          </div>

          {/* Warning */}
          <div className="p-4 rounded-xl bg-gold/10 border border-gold/30">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-gold shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-gold mb-1">Atenção</p>
                <p className="text-muted-foreground">
                  Quando o modo manutenção estiver ativo, <strong>todos os usuários</strong> serão 
                  bloqueados de acessar o app. Apenas administradores podem ver o painel admin.
                </p>
              </div>
            </div>
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
    </>
  );
}
