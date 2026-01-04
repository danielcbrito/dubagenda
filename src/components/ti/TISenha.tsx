import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Key, Eye, EyeOff, Loader2, Save, AlertCircle, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function TISenha() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ti_security_config')
        .select('id, password_hash')
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Criar config inicial
          const { data: newConfig, error: insertError } = await supabase
            .from('ti_security_config')
            .insert({ password_hash: 'admin123' })
            .select()
            .single();

          if (!insertError && newConfig) {
            setConfigId(newConfig.id);
            toast.info("Senha padrão configurada: admin123");
          }
        }
      } else {
        setConfigId(data.id);
      }
    } catch (error) {
      console.error('Erro ao carregar config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    // Validações
    if (!currentPassword) {
      toast.error("Digite a senha atual");
      return;
    }
    if (!newPassword) {
      toast.error("Digite a nova senha");
      return;
    }
    if (newPassword.length < 4) {
      toast.error("A nova senha deve ter pelo menos 4 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    setIsSaving(true);
    try {
      // Verificar senha atual
      const { data: config, error: fetchError } = await supabase
        .from('ti_security_config')
        .select('password_hash')
        .single();

      if (fetchError) throw fetchError;

      if (config.password_hash !== currentPassword) {
        toast.error("Senha atual incorreta");
        setIsSaving(false);
        return;
      }

      // Atualizar senha
      const { error: updateError } = await supabase
        .from('ti_security_config')
        .update({ 
          password_hash: newPassword,
          updated_at: new Date().toISOString()
        })
        .eq('id', configId);

      if (updateError) throw updateError;

      toast.success("Senha alterada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      
      // Limpar autenticação da sessão para forçar nova entrada
      sessionStorage.removeItem('ti_authenticated');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error("Erro ao alterar senha");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-wide text-foreground">
          <span className="text-cyan-400">Senha</span> do Painel TI
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Altere a senha de acesso ao Painel TI
        </p>
      </div>

      {/* Formulário */}
      <Card className="p-6 bg-[#1a1f2e] border-[#2a3142] max-w-lg">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Key className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Alterar Senha</h3>
            <p className="text-xs text-gray-400">
              Esta senha é usada para acessar o Painel TI
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Senha Atual */}
          <div className="space-y-2">
            <Label htmlFor="current" className="text-gray-300">
              Senha Atual
            </Label>
            <div className="relative">
              <Input
                id="current"
                type={showPasswords ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Digite a senha atual..."
                className="bg-[#0d1117] border-[#2a3142] text-white pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              >
                {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Nova Senha */}
          <div className="space-y-2">
            <Label htmlFor="new" className="text-gray-300">
              Nova Senha
            </Label>
            <Input
              id="new"
              type={showPasswords ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Digite a nova senha..."
              className="bg-[#0d1117] border-[#2a3142] text-white"
            />
          </div>

          {/* Confirmar Senha */}
          <div className="space-y-2">
            <Label htmlFor="confirm" className="text-gray-300">
              Confirmar Nova Senha
            </Label>
            <Input
              id="confirm"
              type={showPasswords ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirme a nova senha..."
              className="bg-[#0d1117] border-[#2a3142] text-white"
            />
            {confirmPassword && newPassword && (
              <div className="flex items-center gap-2 mt-1">
                {newPassword === confirmPassword ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-green-400">Senhas coincidem</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    <span className="text-xs text-red-400">Senhas não coincidem</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Botão Salvar */}
          <Button
            onClick={handleSave}
            disabled={isSaving || !currentPassword || !newPassword || !confirmPassword}
            className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white shadow-lg shadow-blue-500/30 mt-4"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Salvar Nova Senha
              </>
            )}
          </Button>
        </div>

        {/* Aviso */}
        <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-200">
              <p className="font-medium mb-1">Importante:</p>
              <ul className="text-xs text-amber-300/80 space-y-1">
                <li>• Esta senha é usada por TODOS que acessam o Painel TI</li>
                <li>• Após alterar, você precisará inserir a nova senha</li>
                <li>• Guarde a senha em local seguro</li>
              </ul>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
