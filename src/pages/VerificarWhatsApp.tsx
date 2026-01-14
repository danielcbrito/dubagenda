import { useState, useEffect } from "react";
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
  const [timeRemaining, setTimeRemaining] = useState(300);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  useEffect(() => {
    if (timeRemaining > 0 && verificationStatus === 'pending') {
      const timer = setTimeout(() => setTimeRemaining(timeRemaining - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeRemaining, verificationStatus]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPhoneDisplay = (phoneNumber: string | null) => {
    if (!phoneNumber) return "";
    const cleaned = phoneNumber.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phoneNumber;
  };

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
        
        setTimeout(() => {
          navigate("/auth?mode=login&verified=whatsapp");
        }, 2000);
      } else {
        setVerificationStatus('error');
        setErrorMessage(data?.error || "Código inválido");
        toast.error(data?.error || "Código inválido");
        
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

  useEffect(() => {
    if (code.length === 6 && verificationStatus === 'pending') {
      handleVerify();
    }
  }, [code]);

  useEffect(() => {
    if (!userId) {
      toast.error("Link inválido. Faça o cadastro novamente.");
      navigate("/auth?mode=signup");
    }
  }, [userId, navigate]);

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col bg-black">
      {/* Background Effects - Green themed */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full opacity-15"
          style={{
            background: 'radial-gradient(ellipse at center, #25D366 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div 
          className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full opacity-10"
          style={{
            background: 'radial-gradient(circle at center, #25D366 0%, transparent 70%)',
            filter: 'blur(60px)',
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
                  background: 'radial-gradient(circle, #25D366 0%, transparent 70%)',
                  filter: 'blur(20px)',
                  transform: 'scale(1.5)',
                }}
              />
              <img 
                src={logoDub} 
                alt="DUB" 
                className="relative w-14 h-14 sm:w-16 sm:h-16 object-contain"
              />
            </div>
          </div>

          {/* Card */}
          <div className="relative">
            <div 
              className="absolute -inset-px rounded-2xl opacity-40"
              style={{
                background: 'linear-gradient(180deg, #25D366 0%, transparent 50%)',
              }}
            />
            
            <div 
              className="relative rounded-2xl p-6 sm:p-8 border border-white/[0.08]"
              style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
                backdropFilter: 'blur(20px)',
              }}
            >
              <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-[#25D366]/30 to-transparent" />

              {/* Status Icon */}
              <div className="flex justify-center mb-6">
                {verificationStatus === 'success' ? (
                  <div className="w-20 h-20 rounded-full bg-[#25D366]/20 flex items-center justify-center animate-scale-in">
                    <CheckCircle2 className="w-10 h-10 text-[#25D366]" />
                  </div>
                ) : verificationStatus === 'error' ? (
                  <div className="w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center animate-scale-in">
                    <XCircle className="w-10 h-10 text-destructive" />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-full bg-[#25D366]/10 flex items-center justify-center border border-[#25D366]/20">
                    <img src={whatsappLogo} alt="WhatsApp" className="w-11 h-11 object-contain" />
                  </div>
                )}
              </div>

              {/* Title */}
              <div className="text-center mb-6">
                <h1 className="text-2xl sm:text-[26px] font-semibold text-white tracking-tight">
                  {verificationStatus === 'success' 
                    ? "Tudo certo!" 
                    : verificationStatus === 'error'
                    ? "Código incorreto"
                    : "Confirme seu WhatsApp"}
                </h1>
                <p className="mt-2 text-sm text-white/50 leading-relaxed">
                  {verificationStatus === 'success' 
                    ? "Redirecionando para o login..." 
                    : verificationStatus === 'error'
                    ? errorMessage
                    : (
                      <>
                        Enviamos um código de 6 dígitos para
                        {phone && (
                          <span className="block mt-1 text-[#25D366] font-medium">
                            {formatPhoneDisplay(phone)}
                          </span>
                        )}
                      </>
                    )}
                </p>
              </div>

              {verificationStatus === 'pending' && (
                <>
                  {/* Timer */}
                  <div className="flex justify-center mb-6">
                    <div 
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                        timeRemaining <= 60 
                          ? 'bg-destructive/10 text-destructive border border-destructive/20' 
                          : 'bg-white/[0.04] text-white/60 border border-white/[0.08]'
                      }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${timeRemaining <= 60 ? 'bg-destructive' : 'bg-[#25D366]'} animate-pulse`} />
                      Expira em {formatTime(timeRemaining)}
                    </div>
                  </div>

                  {/* OTP Input */}
                  <div className="flex justify-center mb-6">
                    <InputOTP
                      maxLength={6}
                      value={code}
                      onChange={setCode}
                      disabled={isLoading}
                    >
                      <InputOTPGroup className="gap-2 sm:gap-3">
                        {[0, 1, 2, 3, 4, 5].map((index) => (
                          <InputOTPSlot
                            key={index}
                            index={index}
                            className="w-11 h-14 sm:w-12 sm:h-16 text-xl sm:text-2xl font-bold bg-white/[0.04] border-white/[0.12] text-white rounded-xl focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366]/30 transition-all"
                          />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  {/* Verify Button */}
                  <Button
                    onClick={handleVerify}
                    disabled={code.length !== 6 || isLoading}
                    className="w-full h-12 bg-[#25D366] hover:bg-[#22c55e] text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-[#25D366]/20 hover:shadow-xl hover:shadow-[#25D366]/30 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Verificando...
                      </span>
                    ) : (
                      "Confirmar código"
                    )}
                  </Button>

                  {/* Resend */}
                  <div className="mt-6 pt-6 border-t border-white/[0.06] text-center">
                    <p className="text-sm text-white/40 mb-2">Não recebeu o código?</p>
                    <button
                      onClick={handleResend}
                      disabled={cooldown > 0 || isResending}
                      className="inline-flex items-center gap-2 text-[#25D366] hover:text-[#22c55e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      {isResending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Reenviando...
                        </>
                      ) : cooldown > 0 ? (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          Reenviar em {cooldown}s
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          Reenviar código
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Back Link */}
          <div className="mt-6 text-center">
            <button
              onClick={() => navigate("/auth?mode=signup")}
              className="text-sm text-white/40 hover:text-white/70 transition-colors"
            >
              ← Voltar ao cadastro
            </button>
          </div>

          {/* Footer Info */}
          <div className="mt-4 text-center">
            <p className="text-xs text-white/30">
              Verifique suas mensagens no WhatsApp
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerificarWhatsApp;
