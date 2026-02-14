import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Check, Loader2, Clock, AlertCircle, CheckCircle2, ArrowLeft, ShieldCheck, Scissors, User, CalendarDays, Lock } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import pixIcon from "@/assets/pix-icon.png";
import logo from "@/assets/logo-dub.png";

interface PixCheckoutData {
  pixQrCode: string;
  pixPayload: string;
  pendingBookingId: string;
  asaasPaymentId: string;
  expiresAt: string;
  value: number;
  serviceName?: string;
  barberName?: string;
  bookingDate?: string;
  bookingTime?: string;
}

/**
 * Checkout PIX premium — estética fintech, confiança e tecnologia.
 */
const ClientePixCheckout = () => {
  const navigate = useNavigate();

  const [pixData, setPixData] = useState<PixCheckoutData | null>(null);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
  const [expired, setExpired] = useState(false);
  const [paid, setPaid] = useState(false);
  const [progressPct, setProgressPct] = useState(0);

  // Recuperar dados do sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem("pix_checkout_data");
    if (!stored) {
      toast.error("Dados do PIX não encontrados.");
      navigate("/cliente/agendar");
      return;
    }
    setPixData(JSON.parse(stored));
  }, [navigate]);

  // Timer de expiração
  useEffect(() => {
    if (!pixData?.expiresAt) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const expires = new Date(pixData.expiresAt).getTime();
      const diff = expires - now;
      if (diff <= 0) {
        setExpired(true);
        setTimeLeft("00:00");
        clearInterval(interval);
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [pixData?.expiresAt]);

  // Polling automático — verifica pagamento a cada 5s
  useEffect(() => {
    if (!pixData?.pendingBookingId || paid || expired) return;
    const poll = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("asaas-webhook", {
          body: { action: "check", pendingBookingId: pixData.pendingBookingId },
        });
        if (error) return;
        if (data?.status === "paid" || data?.status === "already_processed") {
          setPaid(true);
          clearInterval(poll);
          sessionStorage.removeItem("pix_checkout_data");
        }
        if (data?.status === "expired") {
          setExpired(true);
          clearInterval(poll);
          sessionStorage.removeItem("pix_checkout_data");
        }
      } catch { /* silent */ }
    }, 5000);
    return () => clearInterval(poll);
  }, [pixData?.pendingBookingId, paid, expired]);

  // Barra de progresso + redirecionamento após pagamento confirmado
  useEffect(() => {
    if (!paid) return;
    const duration = 3500;
    const step = 50;
    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed += step;
      setProgressPct(Math.min((elapsed / duration) * 100, 100));
      if (elapsed >= duration) {
        clearInterval(interval);
        navigate("/cliente");
      }
    }, step);
    return () => clearInterval(interval);
  }, [paid, navigate]);

  /** Copiar código PIX */
  const handleCopy = useCallback(async () => {
    if (!pixData?.pixPayload) return;
    try {
      await navigator.clipboard.writeText(pixData.pixPayload);
      setCopied(true);
      toast.success("Código copiado!");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error("Erro ao copiar.");
    }
  }, [pixData?.pixPayload]);

  const goBack = async () => {
    // Cancelar cobrança no Asaas e limpar pending_booking
    if (pixData?.asaasPaymentId) {
      try {
        await supabase.functions.invoke('cleanup-pending-payments', {
          body: { 
            action: 'cancel',
            asaasPaymentId: pixData.asaasPaymentId,
            pendingBookingId: pixData.pendingBookingId,
            type: 'booking'
          }
        });
      } catch (err) {
        console.error("Erro ao cancelar cobrança:", err);
      }
    }
    sessionStorage.removeItem("pix_checkout_data");
    navigate("/cliente/agendar");
  };

  // Loading
  if (!pixData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
      </div>
    );
  }

  // Pagamento confirmado
  if (paid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="text-center space-y-5 w-full max-w-xs"
        >
          <div className="relative w-20 h-20 mx-auto">
            <motion.div
              className="absolute inset-0 rounded-full bg-green-500/20"
              animate={{ scale: [1, 1.6], opacity: [0.5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <div className="relative w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-green-500" />
            </div>
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Pagamento confirmado</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Seu agendamento foi registrado com sucesso.
            </p>
          </div>
          <div className="w-full h-1 bg-muted/50 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-green-500 rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">Redirecionando...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-y-auto">
      {/* Gradiente radial sutil de fundo */}
      <div className="fixed inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse at 50% 0%, hsl(var(--primary) / 0.04) 0%, transparent 60%)"
      }} />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header flutuante minimalista */}
        <div className="px-5 pt-[max(env(safe-area-inset-top),1rem)] pb-4">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <button
              onClick={goBack}
              className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <img src={logo} alt="Logo" className="w-7 h-7 rounded-full object-cover" />
              <img src={pixIcon} alt="PIX" className="w-4 h-4 opacity-50" />
            </div>
          </div>
        </div>

        {/* Conteúdo central */}
        <div className="flex-1 flex flex-col items-center px-5 pb-8 max-w-md mx-auto w-full">
          <AnimatePresence mode="wait">
            {expired ? (
              <motion.div
                key="expired"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-center space-y-5 w-full mt-16"
              >
                <div className="w-16 h-16 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-7 h-7 text-destructive" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">QR Code expirado</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    O tempo para pagamento se encerrou.
                  </p>
                </div>
                <button
                  onClick={goBack}
                  className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all active:scale-[0.98]"
                >
                  Tentar novamente
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="active"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="w-full space-y-5"
              >
                {/* Card principal */}
                <div className="rounded-2xl border border-border/40 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-sm overflow-hidden">
                  {/* Valor + Resumo */}
                  <div className="p-5 space-y-4">
                    {/* Total em destaque */}
                    <div className="text-center">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium mb-1">
                        Total a pagar
                      </p>
                      <p className="text-3xl font-bold text-foreground tracking-tight">
                        R$ {pixData.value.toFixed(2).replace(".", ",")}
                      </p>
                    </div>

                    {/* Separador fino */}
                    <div className="h-px bg-border/30" />

                    {/* Resumo do pedido */}
                    <div className="space-y-2.5">
                      {pixData.serviceName && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <Scissors className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Serviço</span>
                          </div>
                          <span className="text-xs font-medium text-foreground">{pixData.serviceName}</span>
                        </div>
                      )}
                      {pixData.barberName && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Profissional</span>
                          </div>
                          <span className="text-xs font-medium text-foreground">{pixData.barberName}</span>
                        </div>
                      )}
                      {pixData.bookingDate && pixData.bookingTime && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Agendamento</span>
                          </div>
                          <span className="text-xs font-medium text-foreground">
                            {pixData.bookingDate} às {pixData.bookingTime}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Separador com recorte visual */}
                  <div className="relative h-px">
                    <div className="absolute inset-0 bg-border/30" />
                    <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-background" />
                    <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-background" />
                  </div>

                  {/* QR Code com moldura tech */}
                  <div className="p-5 flex flex-col items-center space-y-4">
                    <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
                      Escaneie com seu app de banco
                    </p>

                    {/* Moldura tecnológica */}
                    <div className="relative">
                      {/* Cantos HUD */}
                      <div className="absolute -top-1 -left-1 w-5 h-5 border-t-2 border-l-2 border-primary/60 rounded-tl-sm" />
                      <div className="absolute -top-1 -right-1 w-5 h-5 border-t-2 border-r-2 border-primary/60 rounded-tr-sm" />
                      <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-2 border-l-2 border-primary/60 rounded-bl-sm" />
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-2 border-r-2 border-primary/60 rounded-br-sm" />

                      {/* Brilho radial sutil atrás */}
                      <div className="absolute inset-0 -m-4 rounded-2xl pointer-events-none" style={{
                        background: "radial-gradient(circle, hsl(var(--primary) / 0.06) 0%, transparent 70%)"
                      }} />

                      {/* QR Code */}
                      <div className="relative bg-[#F3F3F3] rounded-lg p-3">
                        <img
                          src={`data:image/png;base64,${pixData.pixQrCode}`}
                          alt="QR Code PIX"
                          className="w-40 h-40"
                        />
                      </div>
                    </div>

                    {/* Timer */}
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-muted-foreground/70" />
                      <span className="text-[11px] text-muted-foreground">
                        Expira em <span className="text-foreground font-semibold tabular-nums">{timeLeft}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Botão copiar — fora do card */}
                <button
                  onClick={handleCopy}
                  className={`
                    flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-semibold text-sm
                    transition-all duration-200 active:scale-[0.98]
                    ${copied
                      ? "bg-green-500/15 text-green-500 border border-green-500/20"
                      : "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/30"
                    }
                  `}
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copiar código Pix
                    </>
                  )}
                </button>

                {/* Status de verificação */}
                <div className="flex items-center gap-3 rounded-xl border border-border/30 bg-card/40 px-4 py-3">
                  <div className="relative flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <div className="absolute inset-0 w-2 h-2 rounded-full bg-amber-400 animate-ping opacity-40" />
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Aguardando confirmação automática do pagamento
                  </p>
                </div>

                {/* Bloco de segurança */}
                <div className="pt-2 space-y-3">
                  <div className="h-px bg-border/20" />
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className="flex items-center gap-1.5">
                      <Lock className="w-3 h-3 text-muted-foreground/50" />
                      <span className="text-[10px] text-muted-foreground/60 font-medium tracking-wide uppercase">
                        Ambiente seguro
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/40 leading-relaxed max-w-[260px]">
                      Processado via Pix — Banco Central do Brasil. Criptografia de ponta a ponta.
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <ShieldCheck className="w-3 h-3 text-muted-foreground/30" />
                      <span className="text-[9px] text-muted-foreground/30">
                        Pagamento instantâneo verificado
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default ClientePixCheckout;
