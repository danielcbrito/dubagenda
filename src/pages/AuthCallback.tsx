import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoDub from "@/assets/logo-dub.png";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the hash parameters from the URL (Supabase sends tokens in hash)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const type = hashParams.get("type");
        const error = hashParams.get("error");
        const errorDescription = hashParams.get("error_description");

        // Check for errors in URL
        if (error) {
          console.error("Auth callback error:", error, errorDescription);
          setErrorMessage(errorDescription || "Erro na confirmação");
          setStatus("error");
          return;
        }

        // Handle email confirmation
        if (type === "signup" || type === "email_change" || type === "recovery") {
          if (accessToken && refreshToken) {
            // Set the session with the tokens
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (sessionError) {
              console.error("Session error:", sessionError);
              setErrorMessage("Erro ao processar confirmação");
              setStatus("error");
              return;
            }

            // Clear pending verification email
            localStorage.removeItem("pendingVerificationEmail");
            
            setStatus("success");
            toast.success("E-mail confirmado com sucesso!");
            
            // Redirect after short delay
            setTimeout(() => {
              if (type === "recovery") {
                navigate("/resetar-senha");
              } else {
                navigate("/auth?verified=true");
              }
            }, 2000);
            return;
          }
        }

        // Try to get existing session
        const { data: { session }, error: getSessionError } = await supabase.auth.getSession();
        
        if (getSessionError) {
          console.error("Get session error:", getSessionError);
          setErrorMessage("Erro ao verificar sessão");
          setStatus("error");
          return;
        }

        if (session?.user?.email_confirmed_at) {
          localStorage.removeItem("pendingVerificationEmail");
          setStatus("success");
          toast.success("E-mail confirmado com sucesso!");
          setTimeout(() => {
            navigate("/auth?verified=true");
          }, 2000);
          return;
        }

        // If no tokens and no session, show error
        setErrorMessage("Link de confirmação inválido ou expirado");
        setStatus("error");

      } catch (err) {
        console.error("Callback processing error:", err);
        setErrorMessage("Erro ao processar confirmação");
        setStatus("error");
      }
    };

    handleCallback();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden px-4" style={{ background: '#000000' }}>
      {/* Ambient background lights */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/3 rounded-full blur-[150px]" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-[480px] animate-fade-in">
        {/* Logo */}
        <div className="flex justify-center mb-12 animate-scale-in">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
            <img 
              src={logoDub} 
              alt="DUB" 
              className="relative w-16 h-16 object-contain drop-shadow-2xl"
            />
          </div>
        </div>

        {/* Card */}
        <div className="relative group">
          <div className="absolute -inset-[1px] bg-gradient-to-b from-primary/20 via-primary/5 to-transparent rounded-2xl blur-sm opacity-60" />
          
          <div 
            className="relative bg-gradient-to-b from-white/[0.07] to-white/[0.02] rounded-2xl p-10 border border-white/10 shadow-2xl overflow-hidden text-center"
            style={{
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            }}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

            {status === "loading" && (
              <>
                <Loader2 className="w-16 h-16 text-primary mx-auto mb-6 animate-spin" />
                <h2 className="text-2xl font-semibold text-white mb-4">
                  Confirmando seu e-mail...
                </h2>
                <p className="text-white/60">
                  Aguarde enquanto processamos sua confirmação
                </p>
              </>
            )}

            {status === "success" && (
              <>
                <div className="relative mx-auto mb-6 w-20 h-20">
                  <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl animate-pulse" />
                  <CheckCircle2 className="relative w-20 h-20 text-green-500" />
                </div>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  E-mail Confirmado!
                </h2>
                <p className="text-white/60 mb-6">
                  Sua conta foi verificada com sucesso. Redirecionando...
                </p>
                <div className="flex items-center justify-center gap-2 text-white/40">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Redirecionando para o login...</span>
                </div>
              </>
            )}

            {status === "error" && (
              <>
                <div className="relative mx-auto mb-6 w-20 h-20">
                  <div className="absolute inset-0 bg-destructive/20 rounded-full blur-xl" />
                  <XCircle className="relative w-20 h-20 text-destructive" />
                </div>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  Erro na Confirmação
                </h2>
                <p className="text-white/60 mb-6">
                  {errorMessage}
                </p>
                <div className="flex flex-col gap-3">
                  <Button 
                    onClick={() => navigate("/auth?mode=login")}
                    className="w-full h-12 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white font-semibold rounded-xl"
                  >
                    Ir para Login
                  </Button>
                  <Button 
                    onClick={() => navigate("/auth?mode=signup")}
                    variant="ghost"
                    className="w-full h-12 text-white/70 hover:text-white hover:bg-white/5"
                  >
                    Criar nova conta
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;
