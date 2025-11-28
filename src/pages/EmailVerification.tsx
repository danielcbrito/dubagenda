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
    <div className="min-h-screen relative flex items-center justify-center bg-gradient-to-br from-black via-background to-black">
      {/* Subtle radial gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,49,49,0.03),transparent_70%)]" />
      
      {/* Logo at top */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2">
        <img src={logoDub} alt="DUB" className="w-16 h-16 object-contain drop-shadow-glow-red" />
      </div>

      {/* Main card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="card-glass-dark p-12 rounded-3xl shadow-glow-red border border-primary/10">
          {/* Icon */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-3xl animate-pulse" />
              <div className="relative rounded-full bg-gradient-primary p-8 shadow-glow-red">
                {isVerified ? (
                  <CheckCircle className="h-16 w-16 text-primary-foreground" />
                ) : (
                  <Mail className="h-16 w-16 text-primary-foreground animate-bounce" />
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="text-center space-y-6">
            <h1 className="text-3xl font-bold tracking-wide text-foreground">
              {isVerified ? "Conta Verificada!" : "Verifique seu e-mail"}
            </h1>

            {isVerified ? (
              <div className="space-y-4">
                <p className="text-lg text-foreground/90 leading-relaxed">
                  Sua conta foi verificada com sucesso!
                </p>
                <p className="text-sm text-muted-foreground">
                  Redirecionando para o login...
                </p>
                <div className="flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <p className="text-base text-foreground/90 leading-relaxed">
                  Nós enviamos um link de confirmação para o seu e-mail.
                </p>
                
                {userEmail && (
                  <div className="p-4 bg-secondary/30 rounded-xl border border-primary/10">
                    <p className="font-semibold text-lg text-primary break-all">
                      {userEmail}
                    </p>
                  </div>
                )}

                <p className="text-sm text-muted-foreground leading-relaxed">
                  Para continuar, acesse sua caixa de entrada e confirme sua conta.
                </p>

                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  <span>Verifique também sua pasta de spam</span>
                </div>
              </div>
            )}
          </div>

          {/* Buttons */}
          {!isVerified && (
            <div className="mt-8 space-y-3">
              <Button
                onClick={handleResendEmail}
                disabled={isResending}
                className="w-full h-12 bg-gradient-primary hover:opacity-90 shadow-glow-red font-semibold text-base transition-all"
              >
                {isResending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Reenviando...
                  </>
                ) : (
                  "Reenviar e-mail"
                )}
              </Button>

              <Button
                onClick={handleBackToLogin}
                variant="ghost"
                className="w-full h-12 text-muted-foreground hover:text-primary hover:bg-secondary/20 transition-colors font-medium"
              >
                Voltar para login
              </Button>
            </div>
          )}
        </div>

        {/* Footer text */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          Ao confirmar seu e-mail, você concorda com nossos termos de uso
        </p>
      </div>
    </div>
  );
};

export default EmailVerification;
