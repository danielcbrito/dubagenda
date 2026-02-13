import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Check, Loader2, Clock, AlertCircle, CheckCircle2, ArrowLeft, ShieldCheck, Scissors, User, CalendarDays } from "lucide-react";
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
 * Tela de checkout PIX premium.
 * Identidade visual, resumo do pedido, QR Code, polling automático e redirecionamento.
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

  const goBack = () => {
    sessionStorage.removeItem("pix_checkout_data");
    navigate("/cliente/agendar");
  };

  // Loading
  if (!pixData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header com branding */}
      <div className="px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 border-b border-border/20">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button
            onClick={goBack}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted/50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </button>
          <div className="flex items-center gap-2.5 flex-1">
            <img src={logo} alt="Logo" className="w-6 h-6 rounded-full object-cover" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground leading-tight">Pagamento via Pix</span>
              <span className="text-[10px] text-muted-foreground leading-tight">Ambiente seguro</span>
            </div>
          </div>
          <img src={pixIcon} alt="PIX" className="w-5 h-5 opacity-60" />
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 flex flex-col items-center px-4 py-5 max-w-lg mx-auto w-full overflow-y-auto">
        <AnimatePresence mode="wait">
          {expired ? (
            <motion.div
              key="expired"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-center space-y-5 w-full mt-12"
            >
              <div className="w-16 h-16 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto">
                <AlertCircle className="w-7 h-7 text-destructive" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">QR Code expirado</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  O tempo para pagamento se encerrou. Tente novamente.
                </p>
              </div>
              <button
                onClick={goBack}
                className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all active:scale-[0.98]"
              >
                Voltar para agendamento
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="active"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="w-full space-y-4 flex flex-col items-center"
            >
              {/* Resumo do pedido */}
              <div className="w-full rounded-xl border border-border/30 bg-card/50 p-4 space-y-3">
                <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-semibold">
                  Resumo do pedido
                </p>
                <div className="space-y-2.5">
                  {pixData.serviceName && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Scissors className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">Serviço</p>
                        <p className="text-sm font-medium text-foreground truncate">{pixData.serviceName}</p>
                      </div>
                    </div>
                  )}
                  {pixData.barberName && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <User className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">Profissional</p>
                        <p className="text-sm font-medium text-foreground">{pixData.barberName}</p>
                      </div>
                    </div>
                  )}
                  {pixData.bookingDate && pixData.bookingTime && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <CalendarDays className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">Data e horário</p>
                        <p className="text-sm font-medium text-foreground">
                          {pixData.bookingDate} às {pixData.bookingTime}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Valor total */}
                <div className="border-t border-border/20 pt-3 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="text-xl font-bold text-foreground">
                    R$ {pixData.value.toFixed(2).replace(".", ",")}
                  </span>
                </div>
              </div>

              {/* QR Code */}
              <div className="relative pt-1">
                <div className="bg-[#F5F5F5] rounded-2xl p-4 shadow-md">
                  <img
                    src={`data:image/png;base64,${pixData.pixQrCode}`}
                    alt="QR Code PIX"
                    className="w-44 h-44 sm:w-48 sm:h-48"
                  />
                </div>
                <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-card border border-border/30 rounded-full px-3 py-1 flex items-center gap-1.5 shadow-sm">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    Escaneie com seu app de banco
                  </span>
                </div>
              </div>

              {/* Botão copiar */}
              <button
                onClick={handleCopy}
                className="flex items-center justify-center gap-2 w-full max-w-xs py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all active:scale-[0.98] mt-2"
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

              {/* Timer */}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">
                  Expira em <span className="text-foreground font-semibold">{timeLeft}</span>
                </span>
              </div>

              {/* Status de verificação */}
              <div className="flex items-center gap-2.5 bg-muted/30 border border-border/20 rounded-xl px-4 py-3 w-full max-w-xs">
                <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
                <p className="text-xs text-muted-foreground leading-snug">
                  Aguardando confirmação automática do pagamento
                </p>
              </div>

              {/* Badge de segurança */}
              <div className="flex items-center gap-1.5 pt-1 pb-4">
                <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground/50" />
                <span className="text-[10px] text-muted-foreground/50 font-medium">
                  Pagamento seguro via Pix
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ClientePixCheckout;
