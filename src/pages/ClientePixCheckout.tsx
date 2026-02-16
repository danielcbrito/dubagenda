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
              className="absolute inset-0 rounded-full bg-emerald-500/20"
              animate={{ scale: [1, 1.6], opacity: [0.5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <div className="relative w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-emerald-500" />
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
              className="h-full bg-emerald-500 rounded-full"
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
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header — Logo + PIX */}
        <div className="px-5 pt-[max(env(safe-area-inset-top),1rem)] pb-3">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <button
              onClick={goBack}
              className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2.5">
              <img src={logo} alt="Logo" className="w-6 h-6 rounded-full object-cover" />
              <div className="w-px h-4 bg-border/40" />
              <img src={pixIcon} alt="PIX" className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Conteúdo */}
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
                <div className="w-14 h-14 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">QR Code expirado</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    O tempo para pagamento se encerrou.
                  </p>
                </div>
                <button
                  onClick={goBack}
                  className="w-full py-3 bg-primary text-primary-foreground font-semibold text-sm rounded-xl hover:bg-primary/90 transition-all active:scale-[0.98]"
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
                className="w-full space-y-4"
              >
                {/* Valor */}
                <div className="text-center pt-2 pb-1">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60 font-medium">
                    Total
                  </p>
                  <p className="text-2xl font-bold text-foreground tracking-tight mt-0.5">
                    R$ {pixData.value.toFixed(2).replace(".", ",")}
                  </p>
                </div>

                {/* QR Code Card */}
                <div className="rounded-2xl border border-border/30 bg-card/60 backdrop-blur-sm overflow-hidden">
                  {/* Detalhes do pedido */}
                  <div className="px-4 py-3 space-y-2">
                    {pixData.serviceName && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Scissors className="w-3 h-3 text-muted-foreground/50" />
                          <span className="text-[11px] text-muted-foreground">Serviço</span>
                        </div>
                        <span className="text-[11px] font-medium text-foreground">{pixData.serviceName}</span>
                      </div>
                    )}
                    {pixData.barberName && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="w-3 h-3 text-muted-foreground/50" />
                          <span className="text-[11px] text-muted-foreground">Profissional</span>
                        </div>
                        <span className="text-[11px] font-medium text-foreground">{pixData.barberName}</span>
                      </div>
                    )}
                    {pixData.bookingDate && pixData.bookingTime && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="w-3 h-3 text-muted-foreground/50" />
                          <span className="text-[11px] text-muted-foreground">Data</span>
                        </div>
                        <span className="text-[11px] font-medium text-foreground">
                          {pixData.bookingDate} • {pixData.bookingTime}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Separador ticket-style */}
                  <div className="relative h-px my-0">
                    <div className="absolute inset-0 bg-border/20" style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent, transparent 4px, hsl(var(--background)) 4px, hsl(var(--background)) 8px)" }} />
                    <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-background" />
                    <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-background" />
                  </div>

                  {/* QR Code */}
                  <div className="p-5 flex flex-col items-center space-y-3">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/50 font-medium">
                      Escaneie com seu banco
                    </p>

                    <div className="relative">
                      {/* Cantos */}
                      <div className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-2 border-l-2 border-primary/40 rounded-tl-sm" />
                      <div className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-2 border-r-2 border-primary/40 rounded-tr-sm" />
                      <div className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-2 border-l-2 border-primary/40 rounded-bl-sm" />
                      <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-2 border-r-2 border-primary/40 rounded-br-sm" />

                      <div className="relative rounded-lg p-2.5" style={{ background: "hsl(0 0% 95%)" }}>
                        <img
                          src={`data:image/png;base64,${pixData.pixQrCode}`}
                          alt="QR Code PIX"
                          className="w-36 h-36"
                        />
                      </div>
                    </div>

                    {/* Timer */}
                    <div className="flex items-center gap-1.5 bg-muted/30 px-3 py-1.5 rounded-full">
                      <Clock className="w-3 h-3 text-muted-foreground/60" />
                      <span className="text-[10px] text-muted-foreground/70">
                        Expira em
                      </span>
                      <span className="text-[11px] text-foreground font-bold tabular-nums">{timeLeft}</span>
                    </div>
                  </div>
                </div>

                {/* Botão copiar */}
                <motion.button
                  onClick={handleCopy}
                  whileTap={{ scale: 0.97 }}
                  className={`
                    flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-[13px]
                    transition-all duration-200
                    ${copied
                      ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                      : "bg-primary text-primary-foreground"
                    }
                  `}
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Código copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copiar código Pix
                    </>
                  )}
                </motion.button>

                {/* Status */}
                <div className="flex items-center gap-2.5 rounded-xl border border-border/20 bg-card/30 px-3.5 py-2.5">
                  <div className="relative flex-shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <div className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping opacity-40" />
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 leading-snug">
                    Aguardando confirmação do pagamento
                  </p>
                </div>

                {/* Segurança — compacto */}
                <div className="flex items-center justify-center gap-1.5 pt-1">
                  <Lock className="w-2.5 h-2.5 text-muted-foreground/20" />
                  <span className="text-[9px] text-muted-foreground/20 tracking-wide">
                    Pix • Banco Central • Criptografia E2E
                  </span>
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
