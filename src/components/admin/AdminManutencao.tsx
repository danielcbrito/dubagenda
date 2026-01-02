import { useState, useEffect } from "react";
import { Wrench, AlertTriangle, Loader2, Calendar, Clock, Bell, Mail, Plus, Trash2, UserCheck, Globe } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  manutencao_ips_permitidos: string[] | null;
}

interface AllowedEmail {
  id: string;
  email: string;
  descricao: string | null;
  created_at: string;
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
  
  // Emails permitidos
  const [allowedEmails, setAllowedEmails] = useState<AllowedEmail[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newEmailDesc, setNewEmailDesc] = useState("");
  const [isAddingEmail, setIsAddingEmail] = useState(false);

  // IPs permitidos
  const [allowedIPs, setAllowedIPs] = useState<string[]>([]);
  const [newIP, setNewIP] = useState("");
  const [isAddingIP, setIsAddingIP] = useState(false);

  useEffect(() => {
    loadConfig();
    loadAllowedEmails();
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("webhook_config")
        .select("id, manutencao_ativa, manutencao_mensagem, manutencao_inicio_programada, manutencao_fim_programada, manutencao_aviso_ativo, manutencao_aviso_mensagem, manutencao_ips_permitidos")
        .order("updated_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const configData = data as MaintenanceConfig;
        setConfig(configData);
        setMessage(configData.manutencao_mensagem || "Estamos realizando melhorias para você. Voltamos em breve!");
        
        if (configData.manutencao_inicio_programada) {
          setScheduledStart(formatDateTimeLocal(configData.manutencao_inicio_programada));
        }
        if (configData.manutencao_fim_programada) {
          setScheduledEnd(formatDateTimeLocal(configData.manutencao_fim_programada));
        }
        
        setWarningActive(configData.manutencao_aviso_ativo || false);
        setWarningMessage(configData.manutencao_aviso_mensagem || "");
        setAllowedIPs(configData.manutencao_ips_permitidos || []);
      }
    } catch (error) {
      console.error("Error loading config:", error);
      toast.error("Erro ao carregar configurações");
    } finally {
      setIsLoading(false);
    }
  };

  const loadAllowedEmails = async () => {
    try {
      const { data, error } = await supabase
        .from("manutencao_emails_permitidos")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAllowedEmails(data || []);
    } catch (error) {
      console.error("Error loading allowed emails:", error);
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
        toast.success("Modo manutenção ATIVADO");
      } else {
        toast.success("Modo manutenção DESATIVADO");
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

      toast.success("Mensagem atualizada");
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
      
      toast.success(startDate && endDate ? "Manutenção programada salva" : "Manutenção programada removida");
    } catch (error) {
      console.error("Error saving scheduled maintenance:", error);
      toast.error("Erro ao salvar");
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
      toast.error("Erro ao limpar");
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
      
      toast.success("Aviso salvo");
    } catch (error) {
      console.error("Error saving warning:", error);
      toast.error("Erro ao salvar aviso");
    } finally {
      setIsSaving(false);
    }
  };

  const addAllowedEmail = async () => {
    if (!newEmail.trim()) {
      toast.error("Digite um e-mail");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      toast.error("E-mail inválido");
      return;
    }

    setIsAddingEmail(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("manutencao_emails_permitidos")
        .insert({
          email: newEmail.trim().toLowerCase(),
          descricao: newEmailDesc.trim() || null,
          created_by: user?.id
        });

      if (error) {
        if (error.code === '23505') {
          toast.error("Este e-mail já está na lista");
        } else {
          throw error;
        }
        return;
      }

      toast.success("E-mail adicionado");
      setNewEmail("");
      setNewEmailDesc("");
      loadAllowedEmails();
    } catch (error) {
      console.error("Error adding email:", error);
      toast.error("Erro ao adicionar e-mail");
    } finally {
      setIsAddingEmail(false);
    }
  };

  const removeAllowedEmail = async (id: string) => {
    try {
      const { error } = await supabase
        .from("manutencao_emails_permitidos")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("E-mail removido");
      setAllowedEmails(prev => prev.filter(e => e.id !== id));
    } catch (error) {
      console.error("Error removing email:", error);
      toast.error("Erro ao remover e-mail");
    }
  };

  // Validação de IP
  const isValidIP = (ip: string): boolean => {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipv4Regex.test(ip)) return false;
    const parts = ip.split('.').map(Number);
    return parts.every(p => p >= 0 && p <= 255);
  };

  const addAllowedIP = async () => {
    const trimmedIP = newIP.trim();
    if (!trimmedIP) {
      toast.error("Digite um IP");
      return;
    }

    if (!isValidIP(trimmedIP)) {
      toast.error("IP inválido. Use o formato: 192.168.1.1");
      return;
    }

    if (allowedIPs.includes(trimmedIP)) {
      toast.error("Este IP já está na lista");
      return;
    }

    setIsAddingIP(true);
    try {
      const newList = [...allowedIPs, trimmedIP];
      
      const { error } = await supabase
        .from("webhook_config")
        .update({
          manutencao_ips_permitidos: newList,
          updated_at: new Date().toISOString()
        })
        .eq("id", config!.id);

      if (error) throw error;

      setAllowedIPs(newList);
      setNewIP("");
      toast.success("IP adicionado");
    } catch (error) {
      console.error("Error adding IP:", error);
      toast.error("Erro ao adicionar IP");
    } finally {
      setIsAddingIP(false);
    }
  };

  const removeAllowedIP = async (ip: string) => {
    try {
      const newList = allowedIPs.filter(i => i !== ip);
      
      const { error } = await supabase
        .from("webhook_config")
        .update({
          manutencao_ips_permitidos: newList,
          updated_at: new Date().toISOString()
        })
        .eq("id", config!.id);

      if (error) throw error;

      setAllowedIPs(newList);
      toast.success("IP removido");
    } catch (error) {
      console.error("Error removing IP:", error);
      toast.error("Erro ao remover IP");
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
      <Card className="p-5 card-glass">
        <div className="flex items-center gap-3 mb-5">
          <div className={`p-2 rounded-lg ${config?.manutencao_ativa ? 'bg-destructive/20' : 'bg-primary/20'}`}>
            <Wrench className={`w-4 h-4 ${config?.manutencao_ativa ? 'text-destructive' : 'text-primary'}`} />
          </div>
          <div>
            <h3 className="font-medium text-sm">Modo Manutenção</h3>
            <p className="text-xs text-muted-foreground">Bloqueia acesso imediatamente</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className={`flex items-center justify-between p-3 rounded-lg border ${
            config?.manutencao_ativa 
              ? 'bg-destructive/10 border-destructive/30' 
              : 'bg-secondary/50 border-border'
          }`}>
            <div className="flex items-center gap-2">
              {config?.manutencao_ativa && (
                <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
              )}
              <div>
                <p className="text-sm font-medium">
                  {config?.manutencao_ativa ? "Ativo" : "Inativo"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {config?.manutencao_ativa ? "Usuários bloqueados" : "Sistema normal"}
                </p>
              </div>
            </div>
            <Switch
              checked={config?.manutencao_ativa || false}
              onCheckedChange={handleToggleChange}
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maintenance-message" className="text-xs">Mensagem</Label>
            <Textarea
              id="maintenance-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Mensagem exibida aos usuários..."
              className="min-h-[80px] text-sm input-glass resize-none"
            />
            <Button
              onClick={saveMessage}
              disabled={isSaving}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              {isSaving && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
              Salvar
            </Button>
          </div>
        </div>
      </Card>

      {/* Emails Permitidos */}
      <Card className="p-5 card-glass">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-lg bg-green-500/20">
            <UserCheck className="w-4 h-4 text-green-500" />
          </div>
          <div>
            <h3 className="font-medium text-sm">E-mails Permitidos</h3>
            <p className="text-xs text-muted-foreground">Usuários que podem acessar durante manutenção</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Add new email */}
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="flex-1 text-sm input-glass"
              />
              <Button
                onClick={addAllowedEmail}
                disabled={isAddingEmail || !newEmail.trim()}
                size="sm"
                className="shrink-0"
              >
                {isAddingEmail ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </Button>
            </div>
            <Input
              type="text"
              value={newEmailDesc}
              onChange={(e) => setNewEmailDesc(e.target.value)}
              placeholder="Descrição (opcional)"
              className="text-sm input-glass"
            />
          </div>

          {/* Email list */}
          {allowedEmails.length > 0 ? (
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {allowedEmails.map((item) => (
                <div 
                  key={item.id} 
                  className="flex items-center justify-between p-2 rounded-lg bg-secondary/50 border border-border"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.email}</p>
                      {item.descricao && (
                        <p className="text-xs text-muted-foreground truncate">{item.descricao}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={() => removeAllowedEmail(item.id)}
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">
              Nenhum e-mail permitido. Apenas administradores terão acesso.
            </p>
          )}

          <div className="text-xs text-muted-foreground bg-secondary/30 p-2 rounded-lg">
            <strong>Nota:</strong> Administradores sempre podem acessar, mesmo sem estar na lista.
          </div>
        </div>
      </Card>

      {/* IPs Permitidos */}
      <Card className="p-5 card-glass">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-lg bg-purple-500/20">
            <Globe className="w-4 h-4 text-purple-500" />
          </div>
          <div>
            <h3 className="font-medium text-sm">IPs Permitidos</h3>
            <p className="text-xs text-muted-foreground">Dispositivos que podem acessar durante manutenção (por IP)</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Add new IP */}
          <div className="flex gap-2">
            <Input
              type="text"
              value={newIP}
              onChange={(e) => setNewIP(e.target.value)}
              placeholder="Ex: 192.168.1.100"
              className="flex-1 text-sm input-glass"
            />
            <Button
              onClick={addAllowedIP}
              disabled={isAddingIP || !newIP.trim()}
              size="sm"
              className="shrink-0"
            >
              {isAddingIP ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* IP list */}
          {allowedIPs.length > 0 ? (
            <div className="space-y-2 max-h-[150px] overflow-y-auto">
              {allowedIPs.map((ip) => (
                <div 
                  key={ip} 
                  className="flex items-center justify-between p-2 rounded-lg bg-secondary/50 border border-border"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <p className="text-sm font-mono">{ip}</p>
                  </div>
                  <Button
                    onClick={() => removeAllowedIP(ip)}
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">
              Nenhum IP permitido. Apenas e-mails autorizados e administradores terão acesso.
            </p>
          )}

          <div className="text-xs text-muted-foreground bg-secondary/30 p-2 rounded-lg">
            <strong>Dica:</strong> Para descobrir seu IP, pesquise "meu ip" no Google.
          </div>
        </div>
      </Card>

      {/* Manutenção Programada */}
      <Card className="p-5 card-glass">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-lg bg-blue-500/20">
            <Calendar className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <h3 className="font-medium text-sm">Manutenção Programada</h3>
            <p className="text-xs text-muted-foreground">Agende um período automático</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="scheduled-start" className="text-xs flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Início
              </Label>
              <Input
                id="scheduled-start"
                type="datetime-local"
                value={scheduledStart}
                onChange={(e) => setScheduledStart(e.target.value)}
                className="text-sm input-glass"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="scheduled-end" className="text-xs flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Fim
              </Label>
              <Input
                id="scheduled-end"
                type="datetime-local"
                value={scheduledEnd}
                onChange={(e) => setScheduledEnd(e.target.value)}
                className="text-sm input-glass"
              />
            </div>
          </div>

          {config?.manutencao_inicio_programada && config?.manutencao_fim_programada && (
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <p className="text-xs text-blue-400">
                Agendada: {format(new Date(config.manutencao_inicio_programada), "dd/MM 'às' HH:mm", { locale: ptBR })}
                {" → "}
                {format(new Date(config.manutencao_fim_programada), "dd/MM 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={saveScheduledMaintenance}
              disabled={isSaving || (!scheduledStart && !scheduledEnd)}
              size="sm"
              className="text-xs"
            >
              {isSaving && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
              Salvar
            </Button>
            {(scheduledStart || scheduledEnd || config?.manutencao_inicio_programada) && (
              <Button
                onClick={clearScheduledMaintenance}
                disabled={isSaving}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                Limpar
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Aviso Prévio */}
      <Card className="p-5 card-glass">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-lg bg-gold/20">
            <Bell className="w-4 h-4 text-gold" />
          </div>
          <div>
            <h3 className="font-medium text-sm">Aviso Prévio</h3>
            <p className="text-xs text-muted-foreground">Banner de aviso para usuários</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className={`flex items-center justify-between p-3 rounded-lg border ${
            warningActive 
              ? 'bg-gold/10 border-gold/30' 
              : 'bg-secondary/50 border-border'
          }`}>
            <div>
              <p className="text-sm font-medium">{warningActive ? "Ativo" : "Inativo"}</p>
              <p className="text-xs text-muted-foreground">
                {warningActive ? "Usuários verão o aviso" : "Nenhum aviso"}
              </p>
            </div>
            <Switch
              checked={warningActive}
              onCheckedChange={setWarningActive}
              disabled={isSaving}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="warning-message" className="text-xs">Mensagem do aviso</Label>
            <Textarea
              id="warning-message"
              value={warningMessage}
              onChange={(e) => setWarningMessage(e.target.value)}
              placeholder="Ex: Manutenção programada para domingo..."
              className="min-h-[60px] text-sm input-glass resize-none"
            />
          </div>

          <Button
            onClick={saveWarning}
            disabled={isSaving}
            size="sm"
            className="text-xs"
          >
            {isSaving && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
            Salvar
          </Button>
        </div>
      </Card>

      {/* Info */}
      <Card className="p-3 bg-muted/30 border-border/50">
        <div className="flex gap-2">
          <AlertTriangle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Durante a manutenção, apenas administradores e e-mails da lista podem acessar o sistema.
          </p>
        </div>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="card-glass max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              Ativar manutenção?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Usuários não autorizados serão bloqueados do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelActivation} className="text-sm">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmActivation}
              className="bg-destructive hover:bg-destructive/90 text-sm"
            >
              Ativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
