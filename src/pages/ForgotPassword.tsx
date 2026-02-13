import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import logoDub from "@/assets/logo-dub.png";
import { Loader2, Mail, CheckCircle2, ArrowLeft } from "lucide-react";

const emailSchema = z.object({
  email: z.string().trim().email("Email inválido"),
});

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Restaurar cooldown do localStorage ao montar
  useEffect(() => {
    const lastSent = localStorage.getItem('pwd_reset_ts');
    if (lastSent) {
      const diff = 60 - Math.floor((Date.now() - Number(lastSent)) / 1000);
      if (diff > 0) setCooldown(diff);
    }
  }, []);

  // Decrementar cooldown
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

      const productionUrl = window.location.origin.includes('localhost') 
        ? 'https://djtpzvujzmrrslirzwun.lovable.app'
        : window.location.origin;

      const { error } = await supabase.auth.resetPasswordForEmail(
        validated.email,
        {
          redirectTo: `${productionUrl}/resetar-senha`,
        }
      );

      if (error) {
        if (error.message?.includes('rate limit')) {
          toast.error("Você já solicitou a recuperação recentemente. Verifique sua caixa de entrada ou aguarde alguns minutos para tentar novamente.");
          setCooldown(60);
          localStorage.setItem('pwd_reset_ts', String(Date.now()));
        } else {
          toast.error("Erro ao enviar email: " + error.message);
        }
        return;
      }

      localStorage.setItem('pwd_reset_ts', String(Date.now()));
      setCooldown(60);
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

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col bg-black">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full opacity-20"
          style={{
            background: 'radial-gradient(ellipse at center, hsl(var(--primary) / 0.3) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-5 py-8 sm:py-12 overflow-y-auto">
        <div className="w-full max-w-[400px] relative z-10">
          
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div 
                className="absolute inset-0 rounded-full opacity-60"
                style={{
                  background: 'radial-gradient(circle, hsl(var(--primary) / 0.4) 0%, transparent 70%)',
                  filter: 'blur(20px)',
                  transform: 'scale(1.5)',
                }}
              />
              <img 
                src={logoDub} 
                alt="DUB" 
                className="relative w-16 h-16 sm:w-20 sm:h-20 object-contain"
              />
            </div>
          </div>

          {/* Card */}
          <div className="relative">
            <div 
              className="absolute -inset-px rounded-2xl opacity-50"
              style={{
                background: 'linear-gradient(180deg, hsl(var(--primary) / 0.3) 0%, transparent 50%)',
              }}
            />
            
            <div 
              className="relative rounded-2xl p-6 sm:p-8 border border-white/[0.08]"
              style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
                backdropFilter: 'blur(20px)',
              }}
            >
              <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

              {!emailSent ? (
                <>
                  {/* Icon */}
                  <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                      <Mail className="w-8 h-8 text-primary" />
                    </div>
                  </div>

                  {/* Title */}
                  <div className="text-center mb-8">
                    <h1 className="text-2xl sm:text-[26px] font-semibold text-white tracking-tight">
                      Recuperar senha
                    </h1>
                    <p className="mt-2 text-sm text-white/50 leading-relaxed">
                      Digite seu email para receber o link de recuperação
                    </p>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white/80 block">
                        Email
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/30" />
                        <Input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="h-12 pl-11 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30 rounded-xl focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                          placeholder="seu@email.com"
                        />
                      </div>
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full h-12 mt-2 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 disabled:opacity-50"
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
                </>
              ) : (
                <>
                  {/* Success State */}
                  <div className="flex justify-center mb-6">
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 animate-scale-in">
                      <CheckCircle2 className="w-10 h-10 text-primary" />
                    </div>
                  </div>

                  <div className="text-center">
                    <h1 className="text-2xl font-semibold text-white mb-3">
                      Email enviado!
                    </h1>
                    <p className="text-sm text-white/50 mb-6 leading-relaxed">
                      Verifique sua caixa de entrada em<br />
                      <span className="text-primary font-medium">{email}</span>
                    </p>
                    <Button 
                      onClick={() => navigate("/auth")}
                      className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl transition-all duration-200"
                    >
                      Voltar para login
                    </Button>
                  </div>
                </>
              )}

              {/* Back Link */}
              {!emailSent && (
                <div className="mt-6 pt-6 border-t border-white/[0.06] text-center">
                  <button
                    onClick={() => navigate("/auth")}
                    className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar para login
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
