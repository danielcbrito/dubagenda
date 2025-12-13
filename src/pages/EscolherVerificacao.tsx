import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoDub from "@/assets/logo-dub.png";
import { Loader2, Mail, MessageCircle, CheckCircle2 } from "lucide-react";

const EscolherVerificacao = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userId = searchParams.get("user_id");
  const phone = searchParams.get("phone");
  const email = searchParams.get("email");
  const nome = searchParams.get("nome");
  const cpf = searchParams.get("cpf");

  const [isLoadingWhatsApp, setIsLoadingWhatsApp] = useState(false);
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Verificar parâmetros necessários
  useEffect(() => {
    if (!userId) {
      toast.error("Sessão inválida. Faça o cadastro novamente.");
      navigate("/auth?mode=signup");
    }
  }, [userId, navigate]);

  // Formatar telefone para exibição
  const formatPhoneDisplay = (phoneNumber: string | null) => {
    if (!phoneNumber) return "";
    const cleaned = phoneNumber.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phoneNumber;
  };

  // Opção WhatsApp - gera código e redireciona
  const handleWhatsApp = async () => {
    if (!userId || !phone) {
      toast.error("Dados incompletos. Faça o cadastro novamente.");
      navigate("/auth?mode=signup");
      return;
    }

    setIsLoadingWhatsApp(true);

    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-verification', {
        body: {
          action: 'generate',
          user_id: userId,
          phone: phone,
          user_name: nome || "",
          user_email: email || "",
          user_cpf: cpf || "",
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("Código enviado para seu WhatsApp!");
        navigate(`/verificar-whatsapp?user_id=${userId}&phone=${encodeURIComponent(phone)}`);
      } else {
        toast.error(data?.error || "Erro ao enviar código");
      }
    } catch (error: any) {
      console.error("Erro ao gerar código WhatsApp:", error);
      toast.error("Erro ao enviar código. Tente novamente.");
    } finally {
      setIsLoadingWhatsApp(false);
    }
  };

  // Opção Email - reenvia email de confirmação
  const handleEmail = async () => {
    if (!email) {
      toast.error("Email não encontrado. Faça o cadastro novamente.");
      navigate("/auth?mode=signup");
      return;
    }

    setIsLoadingEmail(true);

    try {
      const productionUrl = window.location.origin.includes('localhost') 
        ? 'https://djtpzvujzmrrslirzwun.lovable.app'
        : window.location.origin;

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${productionUrl}/auth/callback`,
        }
      });

      if (error) {
        if (error.message.includes("only request this after") || error.message.includes("rate limit")) {
          toast.error("Aguarde alguns segundos antes de reenviar.");
        } else {
          throw error;
        }
        return;
      }

      setEmailSent(true);
      toast.success("Email de verificação enviado!");
    } catch (error: any) {
      console.error("Erro ao enviar email:", error);
      toast.error("Erro ao enviar email. Tente novamente.");
    } finally {
      setIsLoadingEmail(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden px-4" style={{ background: '#000000' }}>
      {/* Ambient background lights */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-green-500/5 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/3 rounded-full blur-[150px]" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-[520px] animate-fade-in">
        
        {/* Logo */}
        <div className="flex justify-center mb-8 animate-scale-in">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
            <img src={logoDub} alt="DUB" className="relative w-16 h-16 object-contain drop-shadow-2xl" />
          </div>
        </div>

        {/* Card Principal */}
        <div className="relative group">
          <div className="absolute -inset-[1px] bg-gradient-to-b from-primary/20 via-primary/5 to-transparent rounded-2xl blur-sm opacity-60" />
          
          <div 
            className="relative bg-gradient-to-b from-white/[0.07] to-white/[0.02] rounded-2xl p-8 md:p-10 border border-white/10 shadow-2xl overflow-hidden"
            style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

            {/* Ícone */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-primary" />
              </div>
            </div>

            {/* Título */}
            <h1 className="text-2xl font-semibold text-white text-center mb-2">
              Confirme seu Cadastro
            </h1>

            {/* Subtítulo */}
            <p className="text-white/60 text-center mb-8 text-sm">
              Escolha como deseja confirmar seu cadastro na Barbearia DUB
            </p>

            {/* Opções de Verificação */}
            <div className="space-y-4">
              
              {/* Opção WhatsApp */}
              <button
                onClick={handleWhatsApp}
                disabled={isLoadingWhatsApp || isLoadingEmail}
                className="w-full group relative overflow-hidden rounded-xl border border-green-500/20 bg-green-500/5 p-5 text-left transition-all hover:border-green-500/40 hover:bg-green-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                    {isLoadingWhatsApp ? (
                      <Loader2 className="w-6 h-6 text-green-500 animate-spin" />
                    ) : (
                      <MessageCircle className="w-6 h-6 text-green-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-1">
                      Confirmar pelo WhatsApp
                    </h3>
                    <p className="text-sm text-white/60">
                      Receba um código de 6 dígitos no seu WhatsApp
                    </p>
                    {phone && (
                      <p className="text-sm text-green-400 font-medium mt-2">
                        {formatPhoneDisplay(phone)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="absolute right-5 top-1/2 -translate-y-1/2 text-white/30 group-hover:text-green-400 transition-colors">
                  →
                </div>
              </button>

              {/* Divisor */}
              <div className="flex items-center gap-4 py-2">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-white/40 text-sm">ou</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* Opção Email */}
              <button
                onClick={handleEmail}
                disabled={isLoadingEmail || isLoadingWhatsApp || emailSent}
                className="w-full group relative overflow-hidden rounded-xl border border-primary/20 bg-primary/5 p-5 text-left transition-all hover:border-primary/40 hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    {isLoadingEmail ? (
                      <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    ) : emailSent ? (
                      <CheckCircle2 className="w-6 h-6 text-primary" />
                    ) : (
                      <Mail className="w-6 h-6 text-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-1">
                      {emailSent ? "Email Enviado!" : "Confirmar por Email"}
                    </h3>
                    <p className="text-sm text-white/60">
                      {emailSent 
                        ? "Verifique sua caixa de entrada e spam" 
                        : "Receba um link de confirmação no seu email"}
                    </p>
                    {email && (
                      <p className="text-sm text-primary font-medium mt-2">
                        {email}
                      </p>
                    )}
                  </div>
                </div>
                {!emailSent && (
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 text-white/30 group-hover:text-primary transition-colors">
                    →
                  </div>
                )}
              </button>
            </div>

            {/* Info adicional para email */}
            {emailSent && (
              <div className="mt-6 p-4 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-sm text-primary text-center">
                  Clique no link que enviamos para <strong>{email}</strong> para ativar sua conta.
                </p>
              </div>
            )}

            {/* Voltar */}
            <div className="mt-8 text-center">
              <button
                onClick={() => navigate("/auth?mode=signup")}
                className="text-sm text-white/50 hover:text-white/90 transition-colors duration-300"
              >
                ← Voltar para o cadastro
              </button>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="mt-6 text-center">
          <p className="text-white/40 text-xs">
            A verificação é necessária para sua segurança.
          </p>
        </div>
      </div>
    </div>
  );
};

export default EscolherVerificacao;
