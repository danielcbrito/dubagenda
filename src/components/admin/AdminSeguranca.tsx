import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Key, Activity, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function AdminSeguranca() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    
    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.updateUser({ 
        password: newPassword 
      });
      
      if (error) {
        toast.error("Erro ao alterar senha: " + error.message);
        return;
      }
      
      toast.success("Senha alterada com sucesso");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error("Erro inesperado ao alterar senha");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-wide mb-2">Segurança</h1>
        <p className="text-muted-foreground text-sm">
          Gerencie senhas, sessões e logs de acesso
        </p>
      </div>

      {/* Change Password */}
      <Card className="card-glass p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow-red">
            <Key className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Alterar Senha</h3>
            <p className="text-xs text-muted-foreground">Trocar senha de acesso do administrador</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="old-password">Senha Atual</Label>
            <Input
              id="old-password"
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="••••••••"
              className="input-premium mt-2"
            />
          </div>

          <div>
            <Label htmlFor="new-password">Nova Senha</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="input-premium mt-2"
            />
          </div>

          <div>
            <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Digite novamente"
              className="input-premium mt-2"
            />
          </div>

          <Button 
            onClick={handleChangePassword}
            disabled={isLoading || !newPassword || !confirmPassword}
            className="bg-gradient-primary shadow-glow-red hover:scale-[1.02] transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Alterando...
              </>
            ) : (
              "Alterar Senha"
            )}
          </Button>
        </div>
      </Card>

      {/* Session Management */}
      <Card className="card-glass p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-gold flex items-center justify-center shadow-glow-gold">
            <Activity className="w-6 h-6 text-gold-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Controle de Sessão</h3>
            <p className="text-xs text-muted-foreground">Gerenciar sessões ativas</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg border border-border/30">
            <div>
              <p className="font-medium text-sm">Sessão Atual</p>
              <p className="text-xs text-muted-foreground">Chrome - Windows - 192.168.1.10</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-green-500">Ativa</span>
            </div>
          </div>

          <Button 
            variant="outline" 
            className="w-full border-destructive/50 text-destructive hover:bg-destructive/10"
            onClick={() => toast.info("Todas as outras sessões foram encerradas")}
          >
            Encerrar Outras Sessões
          </Button>
        </div>
      </Card>

      {/* Access Logs */}
      <Card className="card-glass p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-titanium flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Logs de Acesso</h3>
            <p className="text-xs text-muted-foreground">Últimas tentativas de acesso ao sistema</p>
          </div>
        </div>

        <div className="space-y-2">
          {[
            { time: "Hoje às 14:32", action: "Login bem-sucedido", ip: "192.168.1.10", success: true },
            { time: "Hoje às 09:15", action: "Login bem-sucedido", ip: "192.168.1.10", success: true },
            { time: "Ontem às 18:47", action: "Logout", ip: "192.168.1.10", success: true },
            { time: "Ontem às 08:22", action: "Login bem-sucedido", ip: "192.168.1.10", success: true },
          ].map((log, index) => (
            <div 
              key={index}
              className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg border border-border/20"
            >
              <div>
                <p className="text-sm font-medium">{log.action}</p>
                <p className="text-xs text-muted-foreground">{log.time} • {log.ip}</p>
              </div>
              <div className={`w-2 h-2 rounded-full ${log.success ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}