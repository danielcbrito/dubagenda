import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import logoDub from "@/assets/logo-dub.png";
import { Loader2, Mail, CheckCircle2 } from "lucide-react";
import { BackArrow } from "@/components/ui/back-arrow";
import { motion } from "framer-motion";

const emailSchema = z.object({
  email: z.string().trim().email("Email inválido"),
});

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    const lastSent = localStorage.getItem('pwd_reset_ts');
    if (lastSent) {
      const diff = 60 - Math.floor((Date.now() - Number(lastSent)) / 1000);
      if (diff > 0) setCooldown(diff);
    }
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown(p => {
      if (p <= 1) { clearInterval(id); return 0; }
      return p - 1;
    }), 1000);
    return () => clearInterval(id);
  }, [cooldown > 0]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldown > 0) {
      toast.error(`Aguarde ${cooldown}s antes de tentar novamente.`);
      return;
    }
    setIsLoading(true);

    try {
      const validated = emailSchema.parse({ email });

      const redirectUrl = window.location.origin.includes('localhost')
        ? 'https://dubagenda.lovable.app/resetar-senha'
        : `${window.location.origin}/resetar-senha`;

      const { error } = await supabase.auth.resetPasswordForEmail(validated.email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        console.error("Reset password error:", error);
        const isInfraError = error.status === 500 || error.status === 504 || error.message?.includes('timeout');
        if (!isInfraError) {
          toast.error("Erro ao solicitar recuperação. Tente novamente.");
          return;
        }
        console.warn("Supabase SMTP infra error (treated as potential success):", error.message);
      }

      setCooldown(60);
      localStorage.setItem('pwd_reset_ts', String(Date.now()));
      setEmailSent(true);
      toast.success("Email de recuperação enviado! Verifique sua caixa de entrada e spam.");
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Erro ao processar solicitação");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const inputClasses = "h-12 pl-11 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all text-sm";

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col bg-background">
      {/* Back - absolute */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="absolute top-0 left-0 pt-[calc(env(safe-area-inset-top)+1rem)] pl-6 z-10"
      >
        <button
          onClick={() => navigate("/auth")}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <BackArrow size={18} />
          <span className="text-[13px]">Voltar</span>
        </button>
      </motion.div>

      <div className="flex-1 flex flex-col justify-center px-6 overflow-y-auto">

        {/* Logo + Title */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center mb-6"
        >
          <img
            src={logoDub}
            alt="DUB"
            className="w-14 h-14 object-contain mb-4"
          />

          {!emailSent ? (
            <>
              <h1 className="text-2xl font-bold text-foreground tracking-tight font-display">
                Recuperar senha
              </h1>
              <p className="text-[13px] text-muted-foreground mt-1.5 text-center max-w-[260px]">
                Digite seu email para receber o link de recuperação
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight font-display">
                Email enviado!
              </h1>
              <p className="text-[13px] text-muted-foreground mt-1.5 text-center">
                Verifique sua caixa de entrada em
                <br />
                <span className="text-primary font-medium">{email}</span>
              </p>
            </>
          )}
        </motion.div>

        {/* Form or CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm mx-auto"
        >
          {!emailSent ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider block">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground/40" />
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClasses}
                    placeholder="seu@email.com"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-[50px] rounded-xl text-[14px] font-semibold transition-all duration-200"
                style={{
                  background: "var(--gradient-primary)",
                  boxShadow: "var(--shadow-glow-red)",
                }}
                disabled={isLoading || cooldown > 0}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enviando...
                  </span>
                ) : cooldown > 0 ? (
                  `Aguarde ${cooldown}s`
                ) : (
                  "Enviar link de recuperação"
                )}
              </Button>
            </form>
          ) : (
            <Button
              onClick={() => navigate("/auth")}
              className="w-full h-[50px] rounded-xl text-[14px] font-semibold transition-all duration-200"
              style={{
                background: "var(--gradient-primary)",
                boxShadow: "var(--shadow-glow-red)",
              }}
            >
              Voltar para login
            </Button>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default ForgotPassword;
