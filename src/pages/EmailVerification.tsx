import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, CheckCircle, Loader2 } from "lucide-react";
import logoDub from "@/assets/logo-dub.png";

const EmailVerification = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isVerified, setIsVerified] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    // Get email from URL params or localStorage
    const email = searchParams.get("email") || localStorage.getItem("pendingVerificationEmail");
    if (email) {
      setUserEmail(email);
      localStorage.setItem("pendingVerificationEmail", email);
    }

    // Check if user just verified their email
    const checkEmailVerification = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user?.email_confirmed_at) {
        setIsVerified(true);
        localStorage.removeItem("pendingVerificationEmail");
        
        // Wait 1.5s then redirect to login
        setTimeout(() => {
          navigate("/auth?mode=login&verified=true");
        }, 1500);
      }
    };

    checkEmailVerification();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user?.email_confirmed_at) {
        setIsVerified(true);
        localStorage.removeItem("pendingVerificationEmail");
        
        setTimeout(() => {
          navigate("/auth?mode=login&verified=true");
        }, 1500);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, searchParams]);

  const handleResendEmail = async () => {
    if (!userEmail) {
      toast.error("Email não encontrado. Por favor, faça o cadastro novamente.");
      return;
    }

    setIsResending(true);

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: userEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/verificar-email?email=${encodeURIComponent(userEmail)}`
        }
      });

      if (error) throw error;

      toast.success("Email de confirmação reenviado com sucesso!");
    } catch (error: any) {
      console.error("Error resending email:", error);
      toast.error("Erro ao reenviar email. Tente novamente.");
    } finally {
      setIsResending(false);
    }
  };

  const handleBackToLogin = () => {
    localStorage.removeItem("pendingVerificationEmail");
    navigate("/auth?mode=login");
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center" style={{ background: '#050505' }}>
      {/* Subtle blur overlay */}
      <div className="absolute inset-0" style={{ 
        backdropFilter: 'blur(2px)',
        background: 'radial-gradient(circle at center, rgba(212,49,49,0.02), transparent 60%)' 
      }} />
      
      {/* Logo at top */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 z-20">
        <img src={logoDub} alt="DUB" className="w-12 h-12 object-contain" style={{ filter: 'drop-shadow(0 0 8px rgba(212,49,49,0.3))' }} />
      </div>

      {/* Main card - clean & centered */}
      <div className="relative z-10 w-full max-w-[420px] mx-4">
        <div className="bg-card rounded-2xl p-8 border border-border/50" style={{
          boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 1px rgba(255,255,255,0.1) inset'
        }}>
          {/* Icon - Clean & Elegant */}
          <div className="flex justify-center mb-6">
            <div className="relative w-16 h-16 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, hsl(0 64% 52%), hsl(0 64% 42%))',
                boxShadow: '0 4px 20px rgba(212,49,49,0.3)'
              }}>
              {isVerified ? (
                <CheckCircle className="h-8 w-8 text-white" />
              ) : (
                <Mail className="h-8 w-8 text-white" />
              )}
            </div>
          </div>

          {/* Content - Clean Typography */}
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-semibold text-foreground" style={{ letterSpacing: '0.02em' }}>
              {isVerified ? "Conta Verificada!" : "Quase lá — confirme seu e-mail"}
            </h2>

            {isVerified ? (
              <div className="space-y-3">
                <p className="text-base text-foreground/90">
                  Sua conta foi verificada com sucesso!
                </p>
                <p className="text-sm text-muted-foreground">
                  Redirecionando para o login...
                </p>
                <div className="flex justify-center pt-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-foreground/80 leading-relaxed">
                  Enviamos um link de confirmação para seu e-mail.
                </p>
                
                {userEmail && (
                  <div className="p-3 bg-secondary/40 rounded-lg border border-border">
                    <p className="font-medium text-sm text-primary break-all">
                      {userEmail}
                    </p>
                  </div>
                )}

                <p className="text-xs text-muted-foreground leading-relaxed">
                  Para continuar, acesse sua caixa de entrada e confirme sua conta.
                </p>

                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                  <span>Não recebeu? Verifique spam ou fale com suporte</span>
                </div>
              </div>
            )}
          </div>

          {/* Buttons - Touch Friendly */}
          {!isVerified && (
            <div className="mt-6 space-y-2">
              <Button
                onClick={handleResendEmail}
                disabled={isResending}
                className="w-full font-medium"
                style={{
                  minHeight: '44px',
                  background: 'linear-gradient(135deg, hsl(0 64% 52%), hsl(0 64% 42%))',
                  boxShadow: '0 4px 12px rgba(212,49,49,0.25)'
                }}
              >
                {isResending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Reenviando...
                  </>
                ) : (
                  "Reenviar e-mail"
                )}
              </Button>

              <Button
                onClick={handleBackToLogin}
                variant="ghost"
                className="w-full text-muted-foreground hover:text-primary hover:bg-secondary/30 font-medium"
                style={{ minHeight: '44px' }}
              >
                Voltar para login
              </Button>
            </div>
          )}
        </div>

        {/* Footer text - subtle */}
        <p className="text-center text-xs text-muted-foreground/60 mt-4">
          Ao confirmar seu e-mail, você concorda com nossos termos de uso
        </p>
      </div>
    </div>
  );
};

export default EmailVerification;
