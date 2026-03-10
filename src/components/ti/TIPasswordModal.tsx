import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Lock, Loader2, Eye, EyeOff, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TIPasswordModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

export function TIPasswordModal({ isOpen, onSuccess, onCancel }: TIPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // Buscar senha configurada
      const { data, error: fetchError } = await supabase
        .from('ti_security_config')
        .select('password_hash')
        .limit(1)
        .single();

      if (fetchError) {
        console.error('Erro ao buscar config:', fetchError);
        // Se não existe config, criar com senha padrão
        if (fetchError.code === 'PGRST116') {
          const { error: insertError } = await supabase
            .from('ti_security_config')
            .insert({ password_hash: 'admin123' });
          
          if (!insertError && password === 'admin123') {
            toast.success("Acesso concedido!");
            sessionStorage.setItem('ti_authenticated', 'true');
            onSuccess();
            return;
          }
        }
        setError("Erro ao verificar senha. Tente novamente.");
        setAttempts(prev => prev + 1);
        return;
      }

      // Verificar senha (comparação direta por simplicidade)
      if (data.password_hash === password) {
        toast.success("Acesso concedido ao Painel TI!");
        sessionStorage.setItem('ti_authenticated', 'true');
        setPassword("");
        setAttempts(0);
        onSuccess();
      } else {
        setError("Senha incorreta. Tente novamente.");
        setAttempts(prev => prev + 1);
        
        if (attempts >= 2) {
          toast.error("Múltiplas tentativas incorretas detectadas");
        }
      }
    } catch (err) {
      console.error('Erro:', err);
      setError("Erro inesperado. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onCancel()}>
      <DialogContent className="sm:max-w-md bg-[#1a1f2e] border-[#2a3142]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl text-white">Acesso Restrito</DialogTitle>
              <DialogDescription className="text-gray-400">
                Digite a senha para acessar o Painel TI
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="ti-password" className="text-gray-300 flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Senha de Acesso
            </Label>
            <div className="relative">
              <Input
                id="ti-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                placeholder="Digite a senha..."
                className="bg-[#0d1117] border-[#2a3142] text-white pr-10 h-12"
                autoFocus
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span className="text-sm text-red-400">{error}</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1 border-[#2a3142] text-gray-300 hover:bg-[#2a3142]"
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!password || isLoading}
              className="flex-1 bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white shadow-lg shadow-blue-500/30"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verificando...
                </>
              ) : (
                "Acessar"
              )}
            </Button>
          </div>

          {attempts >= 3 && (
            <p className="text-xs text-center text-amber-400">
              Muitas tentativas incorretas. Verifique a senha com o administrador.
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
