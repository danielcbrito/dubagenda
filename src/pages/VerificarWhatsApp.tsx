import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoDub from "@/assets/logo-dub.png";
import whatsappLogo from "@/assets/whatsapp-logo.png";
import { Loader2, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const VerificarWhatsApp = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userId = searchParams.get("user_id");
  const phone = searchParams.get("phone");

  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(300); // 5 minutos
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [errorMessage, setErrorMessage] = useState("");

  // Timer para cooldown de reenvio
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // Timer para validade do código
  useEffect(() => {
    if (timeRemaining > 0 && verificationStatus === 'pending') {
      const timer = setTimeout(() => setTimeRemaining(timeRemaining - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeRemaining, verificationStatus]);

  // Formatar tempo restante
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Formatar telefone para exibição
  const formatPhoneDisplay = (phoneNumber: string | null) => {
    if (!phoneNumber) return "";
    const cleaned = phoneNumber.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phoneNumber;
  };

  // Verificar código
  const handleVerify = async () => {
    if (code.length !== 6) {
      toast.error("Digite o código completo de 6 dígitos");
      return;
    }

    if (!userId) {
      toast.error("Sessão inválida. Faça o cadastro novamente.");
      navigate("/auth?mode=signup");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-verification', {
        body: { action: 'verify', user_id: userId, code }
      });

      if (error) throw error;

      if (data?.success) {
        setVerificationStatus('success');
        toast.success("Cadastro confirmado com sucesso!");
        
        // Aguardar 2 segundos e redirecionar para login
        setTimeout(() => {
          navigate("/auth?mode=login&verified=whatsapp");
        }, 2000);
      } else {
        setVerificationStatus('error');
        setErrorMessage(data?.error || "Código inválido");
        toast.error(data?.error || "Código inválido");
        
        // Resetar para permitir nova tentativa
        setTimeout(() => {
          setVerificationStatus('pending');
          setCode("");
        }, 2000);
      }
    } catch (error: any) {
      console.error("Erro ao verificar:", error);
      setVerificationStatus('error');
      setErrorMessage("Erro ao verificar código. Tente novamente.");
      toast.error("Erro ao verificar código");
      
      setTimeout(() => {
        setVerificationStatus('pending');
      }, 2000);
    } finally {
      setIsLoading(false);
    }
  };

  // Reenviar código
  const handleResend = async () => {
    if (cooldown > 0) return;

    if (!userId) {
      toast.error("Sessão inválida. Faça o cadastro novamente.");
      navigate("/auth?mode=signup");
      return;
    }

    setIsResending(true);

    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-verification', {
        body: { action: 'resend', user_id: userId }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("Novo código enviado para seu WhatsApp!");
        setCooldown(60);
        setTimeRemaining(300);
        setCode("");
        setVerificationStatus('pending');
        setErrorMessage("");
      } else {
        if (data?.cooldown_remaining) {
          setCooldown(data.cooldown_remaining);
        }
        toast.error(data?.error || "Erro ao reenviar código");
      }
    } catch (error: any) {
      console.error("Erro ao reenviar:", error);
      toast.error("Erro ao reenviar código");
    } finally {
      setIsResending(false);
    }
  };

  // Auto-submit quando código estiver completo
  useEffect(() => {
    if (code.length === 6 && verificationStatus === 'pending') {
      handleVerify();
    }
  }, [code]);

  // Verificar se tem parâmetros necessários
  useEffect(() => {
    if (!userId) {
      toast.error("Link inválido. Faça o cadastro novamente.");
      navigate("/auth?mode=signup");
    }
  }, [userId, navigate]);

  return (
    <div className="min-h-screen min-h-[100dvh] relative flex items-center justify-center overflow-hidden px-3 sm:px-4 py-6" style={{ background: '#000000' }}>
      {/* Ambient background lights */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-48 sm:w-96 h-48 sm:h-96 bg-green-500/5 rounded-full blur-[80px] sm:blur-[120px] animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-1/4 right-1/4 w-48 sm:w-96 h-48 sm:h-96 bg-primary/5 rounded-full blur-[80px] sm:blur-[120px] animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[600px] h-[300px] sm:h-[600px] bg-green-500/3 rounded-full blur-[100px] sm:blur-[150px]" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-[440px] lg:max-w-[480px] animate-fade-in">
        
        {/* Logo */}
        <div className="flex justify-center mb-6 sm:mb-8 animate-scale-in">
          <div className="relative">
            <div className="absolute inset-0 bg-green-500/20 blur-xl rounded-full" />
            <img src={logoDub} alt="DUB" className="relative w-12 h-12 sm:w-16 sm:h-16 object-contain drop-shadow-2xl" />
          </div>
        </div>

        {/* Card Principal */}
        <div className="relative group">
          <div className="absolute -inset-[1px] bg-gradient-to-b from-green-500/20 via-green-500/5 to-transparent rounded-xl sm:rounded-2xl blur-sm opacity-60" />
          
          <div 
            className="relative bg-gradient-to-b from-white/[0.07] to-white/[0.02] rounded-xl sm:rounded-2xl p-5 sm:p-8 lg:p-10 border border-white/10 shadow-2xl overflow-hidden"
            style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-500/30 to-transparent" />

            {/* Status Icon */}
            <div className="flex justify-center mb-4 sm:mb-6">
              {verificationStatus === 'success' ? (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-green-500/20 flex items-center justify-center animate-scale-in">
                  <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-green-500" />
                </div>
              ) : verificationStatus === 'error' ? (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-destructive/20 flex items-center justify-center animate-scale-in">
                  <XCircle className="w-8 h-8 sm:w-10 sm:h-10 text-destructive" />
                </div>
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-green-500/10 flex items-center justify-center">
                  <img src={whatsappLogo} alt="WhatsApp" className="w-10 h-10 sm:w-12 sm:h-12 object-contain" />
                </div>
              )}
            </div>

            {/* Título */}
            <h1 className="text-xl sm:text-2xl font-semibold text-white text-center mb-2">
              {verificationStatus === 'success' 
                ? "Cadastro Confirmado!" 
                : verificationStatus === 'error'
                ? "Código Incorreto"
                : "Confirme seu WhatsApp"}
            </h1>

            {/* Subtítulo */}
            <p className="text-white/60 text-center mb-5 sm:mb-8 text-xs sm:text-sm px-2">
              {verificationStatus === 'success' 
                ? "Você será redirecionado para o login..." 
                : verificationStatus === 'error'
                ? errorMessage
                : (
                  <>
                    Enviamos um código de 6 dígitos para o seu WhatsApp
                    {phone && (
                      <span className="block mt-1 text-green-400 font-medium">
                        {formatPhoneDisplay(phone)}
                      </span>
                    )}
                  </>
                )}
            </p>

            {verificationStatus === 'pending' && (
              <>
                {/* Timer de validade */}
                <div className="flex justify-center mb-4 sm:mb-6">
                  <div className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full ${timeRemaining <= 60 ? 'bg-destructive/20 text-destructive' : 'bg-white/5 text-white/60'} text-xs sm:text-sm font-medium`}>
                    Código expira em {formatTime(timeRemaining)}
                  </div>
                </div>

                {/* Input OTP - Responsivo */}
                <div className="flex justify-center mb-5 sm:mb-8">
                  <InputOTP
                    maxLength={6}
                    value={code}
                    onChange={setCode}
                    disabled={isLoading}
                  >
                    <InputOTPGroup className="gap-1.5 sm:gap-2 md:gap-3">
                      {[0, 1, 2, 3, 4, 5].map((index) => (
                        <InputOTPSlot
                          key={index}
                          index={index}
                          className="w-10 h-12 sm:w-12 sm:h-14 md:w-14 md:h-16 text-lg sm:text-xl md:text-2xl font-bold bg-white/5 border-white/20 text-white rounded-lg sm:rounded-xl focus:border-green-500 focus:ring-green-500/20"
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                {/* Botão Verificar */}
                <Button
                  onClick={handleVerify}
                  disabled={code.length !== 6 || isLoading}
                  className="w-full h-11 sm:h-12 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-semibold rounded-lg sm:rounded-xl transition-all duration-300 shadow-lg shadow-green-500/25 hover:shadow-xl hover:shadow-green-500/40 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed mb-3 sm:mb-4 text-sm sm:text-base"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    "Confirmar Código"
                  )}
                </Button>

                {/* Reenviar */}
                <div className="text-center">
                  <p className="text-white/50 text-xs sm:text-sm mb-1.5 sm:mb-2">Não recebeu o código?</p>
                  <button
                    onClick={handleResend}
                    disabled={cooldown > 0 || isResending}
                    className="inline-flex items-center gap-1.5 sm:gap-2 text-green-400 hover:text-green-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm font-medium"
                  >
                    {isResending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                        Reenviando...
                      </>
                    ) : cooldown > 0 ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        Aguarde {cooldown}s
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        Reenviar código
                      </>
                    )}
                  </button>
                </div>
              </>
            )}

            {/* Voltar */}
            <div className="mt-5 sm:mt-6 text-center">
              <button
                onClick={() => navigate("/auth?mode=signup")}
                className="text-xs sm:text-sm text-white/50 hover:text-white/90 transition-colors duration-300"
              >
                ← Voltar para o cadastro
              </button>
            </div>
          </div>
        </div>

        {/* Info WhatsApp */}
        <div className="mt-4 sm:mt-6 text-center px-4">
          <p className="text-white/40 text-[10px] sm:text-xs">
            Verifique sua caixa de mensagens no WhatsApp.<br />
            O código expira em 5 minutos.
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerificarWhatsApp;
