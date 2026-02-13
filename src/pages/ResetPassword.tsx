import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import logoDub from "@/assets/logo-dub.png";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

const passwordSchema = z.object({
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string().min(6, "Confirme sua senha"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

const ResetPassword = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [hasValidToken, setHasValidToken] = useState<boolean | null>(null);
  const [passwordReset, setPasswordReset] = useState(false);
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    /**
     * Fluxo de recuperação de senha:
     * 1. Supabase envia email com link que redireciona para /resetar-senha#access_token=...&type=recovery
     * 2. O cliente Supabase detecta os tokens no hash e dispara PASSWORD_RECOVERY
     * 3. Ou os tokens já foram processados via /auth/callback e a sessão já existe
     */
    let resolved = false;

    // Listener para o evento PASSWORD_RECOVERY (tokens no hash)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (resolved) return;
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        resolved = true;
        setHasValidToken(true);
      }
    });

    // Fallback: verificar se já tem sessão válida (veio do /auth/callback)
    const checkExistingSession = async () => {
      // Dar tempo para o Supabase processar os tokens do hash
      await new Promise(r => setTimeout(r, 1500));
      if (resolved) return;

      const { data: { session }, error } = await supabase.auth.getSession();
      if (!error && session) {
        resolved = true;
        setHasValidToken(true);
      } else {
        resolved = true;
        setHasValidToken(false);
        toast.error("Link de recuperação inválido ou expirado");
      }
    };

    checkExistingSession();

    return () => subscription.unsubscribe();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validated = passwordSchema.parse(formData);

      const { error } = await supabase.auth.updateUser({
        password: validated.password,
      });

      if (error) {
        if (error.message.includes("session")) {
          toast.error("Sessão expirada. Solicite um novo link de recuperação.");
          setTimeout(() => navigate("/esqueci-senha"), 2000);
        } else {
          toast.error("Erro ao redefinir senha: " + error.message);
        }
        return;
      }

      setPasswordReset(true);
      toast.success("Senha redefinida com sucesso!");
      
      setTimeout(() => {
        navigate("/auth");
      }, 2000);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Erro ao processar redefinição");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (hasValidToken === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-8 card-premium text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Verificando link de recuperação...</p>
        </Card>
      </div>
    );
  }

  // Invalid token
  if (hasValidToken === false) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-8 card-premium text-center">
          <div className="mx-auto w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Link inválido ou expirado</h2>
          <p className="text-sm text-muted-foreground mb-6">
            O link de recuperação de senha não é válido ou já expirou. Solicite um novo link.
          </p>
          <Button 
            onClick={() => navigate("/esqueci-senha")}
            className="w-full h-11 bg-primary hover:bg-primary/90"
          >
            Solicitar novo link
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md p-8 card-premium">
        <div className="flex justify-center mb-6">
          <img src={logoDub} alt="Barbearia DUB" className="w-20 h-20 object-contain" />
        </div>

        {!passwordReset ? (
          <>
            <h2 className="text-2xl font-bold text-center mb-2">Redefinir senha</h2>
            <p className="text-sm text-muted-foreground text-center mb-6">Digite sua nova senha</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="password" className="text-sm">Nova senha</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className="input-premium mt-1"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>

              <div>
                <Label htmlFor="confirmPassword" className="text-sm">Confirmar nova senha</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="input-premium mt-1"
                  placeholder="Digite a senha novamente"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-11 bg-primary hover:bg-primary/90"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Redefinindo...
                  </>
                ) : (
                  "Redefinir senha"
                )}
              </Button>
            </form>
          </>
        ) : (
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Senha redefinida!</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Sua senha foi atualizada com sucesso. Redirecionando para o login...
            </p>
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
          </div>
        )}
      </Card>
    </div>
  );
};

export default ResetPassword;
