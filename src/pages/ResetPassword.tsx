import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import logoDub from "@/assets/logo-dub.png";
import { Loader2, CheckCircle2, AlertCircle, Lock, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    let resolved = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (resolved) return;
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        resolved = true;
        setHasValidToken(true);
      }
    });

    const checkExistingSession = async () => {
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
      setTimeout(() => navigate("/auth"), 2000);
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

  const inputClasses = "h-12 pl-11 pr-11 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/50 rounded-xl focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all text-sm";

  // Loading
  if (hasValidToken === null) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <img src={logoDub} alt="DUB" className="w-14 h-14 object-contain mb-6" />
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-[13px] text-muted-foreground">Verificando link...</p>
      </div>
    );
  }

  // Invalid
  if (hasValidToken === false) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <img src={logoDub} alt="DUB" className="w-14 h-14 object-contain mb-6" />
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Link expirado</h2>
        <p className="text-[13px] text-muted-foreground text-center mb-6 max-w-[280px]">
          O link de recuperação não é válido ou já expirou. Solicite um novo.
        </p>
        <Button
          onClick={() => navigate("/esqueci-senha")}
          className="w-full max-w-sm h-[50px] rounded-xl text-[14px] font-semibold"
          style={{
            background: "var(--gradient-primary)",
            boxShadow: "var(--shadow-glow-red)",
          }}
        >
          Solicitar novo link
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col bg-background">
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center mb-8"
        >
          <img src={logoDub} alt="DUB" className="w-14 h-14 object-contain mb-4" />

          {!passwordReset ? (
            <>
              <h1 className="text-2xl font-bold text-foreground tracking-tight font-display">
                Redefinir senha
              </h1>
              <p className="text-[13px] text-muted-foreground mt-1.5">
                Digite sua nova senha
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight font-display">
                Senha redefinida!
              </h1>
              <p className="text-[13px] text-muted-foreground mt-1.5">
                Redirecionando para o login...
              </p>
              <Loader2 className="w-5 h-5 animate-spin text-primary mt-4" />
            </>
          )}
        </motion.div>

        {!passwordReset && (
          <motion.form
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            onSubmit={handleSubmit}
            className="w-full max-w-sm space-y-4"
          >
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider block">
                Nova senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground/40" />
                <Input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className={inputClasses}
                  placeholder="Mínimo 6 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider block">
                Confirmar senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground/40" />
                <Input
                  name="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  required
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className={inputClasses}
                  placeholder="Digite a senha novamente"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                >
                  {showConfirm ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-[50px] rounded-xl text-[14px] font-semibold transition-all duration-200"
              style={{
                background: "var(--gradient-primary)",
                boxShadow: "var(--shadow-glow-red)",
              }}
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Redefinindo...
                </span>
              ) : (
                "Redefinir senha"
              )}
            </Button>
          </motion.form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
