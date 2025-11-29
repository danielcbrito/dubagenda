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
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      {/* Small, elegant card - max 400px */}
      <div className="w-full max-w-[400px]">
        <div className="bg-card/40 backdrop-blur-sm rounded-xl p-8 border border-border/30 shadow-2xl">
          
          {/* Small discrete icon */}
          <div className="flex justify-center mb-6">
            {isVerified ? (
              <CheckCircle className="h-10 w-10 text-primary" />
            ) : (
              <Mail className="h-10 w-10 text-muted-foreground" />
            )}
          </div>

          {/* Content - Minimal & Clean */}
          <div className="text-center space-y-6">
            <h1 className="text-xl font-semibold text-foreground tracking-tight">
              {isVerified ? "Conta Verificada" : "Confirme seu e-mail"}
            </h1>

            {isVerified ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Redirecionando...
                </p>
                <div className="flex justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {userEmail && (
                  <div className="px-4 py-3 bg-muted/30 rounded-lg">
                    <p className="text-sm font-medium text-foreground break-all">
                      {userEmail}
                    </p>
                  </div>
                )}

                {/* Primary action button */}
                <Button
                  onClick={handleResendEmail}
                  disabled={isResending}
                  className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-all"
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

                {/* Discrete back link */}
                <button
                  onClick={handleBackToLogin}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Voltar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailVerification;
