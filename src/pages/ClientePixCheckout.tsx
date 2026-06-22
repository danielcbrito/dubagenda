import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Check, Loader2, AlertCircle, CheckCircle2, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import logo from "@/assets/logo-dub.png";
import pixWaitingAsset from "@/assets/pix-waiting.png.asset.json";

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
  provider?: 'asaas' | 'efi' | 'woovi';
  txid?: string;
  correlationId?: string;
  chargeId?: string;
}

const ClientePixCheckout = () => {
  const navigate = useNavigate();

  const [pixData, setPixData] = useState<PixCheckoutData | null>(null);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
  const [expired, setExpired] = useState(false);
  const [paid, setPaid] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [timerPct, setTimerPct] = useState(100);
  const [createdAt] = useState<number>(() => Date.now());

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

  // Timer de expiração + barra de progresso
  useEffect(() => {
    if (!pixData?.expiresAt) return;
    const expires = new Date(pixData.expiresAt).getTime();
    const totalMs = Math.max(1, expires - createdAt);
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = expires - now;
      if (diff <= 0) {
        setExpired(true);
        setTimeLeft("00:00");
        setTimerPct(0);
        clearInterval(interval);
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
      setTimerPct(Math.max(0, Math.min(100, (diff / totalMs) * 100)));
    }, 500);
    return () => clearInterval(interval);
  }, [pixData?.expiresAt, createdAt]);

  // Polling automático — verifica pagamento a cada 4s
  useEffect(() => {
    if (!pixData || paid || expired) return;

    // Provider Woovi: Realtime + polling de fallback em woovi_charges
    if (pixData.provider === 'woovi' && pixData.correlationId) {
      const correlationId = pixData.correlationId;

      const handleStatus = (status?: string | null) => {
        if (status === 'PAID' || status === 'COMPLETED') {
          setPaid(true);
          sessionStorage.removeItem('pix_checkout_data');
          return true;
        }
        if (status === 'EXPIRED' || status === 'CANCELLED') {
          setExpired(true);
          sessionStorage.removeItem('pix_checkout_data');
          return true;
        }
        return false;
      };

      const channel = supabase
        .channel(`woovi-charge-${correlationId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'woovi_charges',
          filter: `correlation_id=eq.${correlationId}`,
        }, (payload) => {
          handleStatus((payload.new as any)?.status);
        })
        .subscribe();

      const checkWoovi = async () => {
        const { data } = await supabase
          .from('woovi_charges')
          .select('status')
          .eq('correlation_id', correlationId)
          .maybeSingle();
        handleStatus(data?.status);
      };
      const interval = setInterval(checkWoovi, 5000);
      checkWoovi();

      return () => {
        clearInterval(interval);
        supabase.removeChannel(channel);
      };
    }

    // Provider Efí: consulta direta na tabela efi_pix_charges (Realtime habilitado)
    if (pixData.provider === 'efi' && pixData.txid) {
      const checkEfi = async () => {
        const { data } = await supabase
          .from('efi_pix_charges')
          .select('status')
          .eq('txid', pixData.txid!)
          .maybeSingle();
        if (data?.status === 'PAID') {
          setPaid(true);
          sessionStorage.removeItem('pix_checkout_data');
          return true;
        }
        if (data?.status === 'EXPIRED' || data?.status === 'CANCELLED') {
          setExpired(true);
          sessionStorage.removeItem('pix_checkout_data');
          return true;
        }
        return false;
      };
      const interval = setInterval(() => { checkEfi(); }, 4000);
      checkEfi();
      return () => clearInterval(interval);
    }

    // Fallback Asaas (legado)
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
  }, [pixData, paid, expired]);

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
    // Apenas volta sem cancelar — o pending_booking permanece para aparecer na home
    sessionStorage.removeItem("pix_checkout_data");
    navigate("/cliente");
  };

  const handleCancel = async () => {
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
    navigate("/cliente");
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

  // Truncate code for visual preview
  const codePreview = pixData.pixPayload
    ? pixData.pixPayload.length > 28
      ? `${pixData.pixPayload.slice(0, 28)}...`
      : pixData.pixPayload
    : "";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3">
        <div className="max-w-md mx-auto grid grid-cols-[auto_1fr_auto] items-center gap-2">
          <button
            onClick={goBack}
            className="w-8 h-8 -ml-1 flex items-center justify-center text-primary active:scale-95 transition-transform"
            aria-label="Voltar"
          >
            <ChevronLeft className="w-6 h-6" strokeWidth={2.5} />
          </button>
          <h1 className="text-center text-[13px] font-bold tracking-[0.18em] text-foreground uppercase">
            Pagamento
          </h1>
          <button
            onClick={goBack}
            className="text-primary text-sm font-medium px-1 active:opacity-70 transition-opacity"
          >
            Ajuda
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-32">
        <div className="max-w-md mx-auto w-full px-5">
          <AnimatePresence mode="wait">
            {expired ? (
              <motion.div
                key="expired"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-center space-y-5 mt-16"
              >
                <div className="w-14 h-14 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Tempo expirado</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    O tempo para pagamento se encerrou.
                  </p>
                </div>
                <button
                  onClick={handleCancel}
                  className="w-full py-3 bg-primary text-primary-foreground font-semibold text-sm rounded-xl hover:bg-primary/90 transition-all active:scale-[0.98]"
                >
                  Tentar novamente
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="active"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="w-full"
              >
                {/* Illustration — mãos segurando celular PIX + relógio */}
                <div className="flex justify-center pt-4 pb-6">
                  <img
                    src={pixWaitingAsset.url}
                    alt="Aguardando pagamento PIX"
                    width={240}
                    height={240}
                    loading="lazy"
                    className="w-[240px] h-[240px] object-contain"
                  />
                </div>

                {/* Title */}
                <h2 className="text-center text-[18px] font-medium text-foreground tracking-tight">
                  Aguardando pagamento
                </h2>
                <p className="text-center text-[13px] text-muted-foreground mt-2 leading-snug px-3">
                  Copie o código abaixo e utilize o Pix Copia e Cola no aplicativo que você vai fazer o pagamento:
                </p>

                {/* Código copia e cola */}
                <button
                  onClick={handleCopy}
                  className="mt-5 w-full rounded-xl border border-dashed border-border bg-background px-4 py-4 flex items-center gap-3 active:scale-[0.99] transition-transform"
                >
                  <span className="flex-1 text-left text-[15px] font-bold text-foreground truncate font-mono">
                    {codePreview}
                  </span>
                  {copied ? (
                    <Check className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  ) : (
                    <Copy className="w-5 h-5 text-primary flex-shrink-0" />
                  )}
                </button>

                {/* Timer — sério, minimalista, fonte menor */}
                <div className="mt-6">
                  <p className="text-[11px] text-muted-foreground tracking-tight">
                    O tempo para você pagar acaba em:
                  </p>
                  <p className="text-[22px] font-semibold text-foreground tabular-nums mt-1 leading-none">
                    {timeLeft}
                  </p>
                  <div className="mt-2 h-[3px] w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-[width] duration-500 ease-linear"
                      style={{ width: `${timerPct}%` }}
                    />
                  </div>
                </div>

                {/* Recibo cinza com borda serrilhada superior */}
                <div className="mt-7 relative">
                  <div
                    className="h-2.5 w-full"
                    style={{
                      backgroundColor: "hsl(var(--muted))",
                      WebkitMaskImage:
                        "radial-gradient(circle at 6px 0, transparent 5px, black 5.5px)",
                      maskImage:
                        "radial-gradient(circle at 6px 0, transparent 5px, black 5.5px)",
                      WebkitMaskSize: "12px 10px",
                      maskSize: "12px 10px",
                      WebkitMaskRepeat: "repeat-x",
                      maskRepeat: "repeat-x",
                    }}
                  />
                  <div className="bg-muted px-4 py-4 rounded-b-xl">
                    <div className="flex items-start gap-3">
                      <img
                        src={logo}
                        alt="Barbearia"
                        className="w-11 h-11 rounded-full object-cover flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold text-foreground truncate">
                          {pixData.barberName ? `Barbeiro ${pixData.barberName}` : "Barbearia DUB"}
                        </p>
                        <p className="text-[13px] text-muted-foreground mt-0.5 truncate">
                          {pixData.serviceName ?? "Agendamento"}
                          {pixData.bookingDate && pixData.bookingTime
                            ? ` • ${pixData.bookingDate} ${pixData.bookingTime}`
                            : ""}
                        </p>
                      </div>
                    </div>
                    <div className="h-px bg-border/50 my-3" />
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] text-foreground">Total</span>
                      <span className="text-[15px] font-bold text-foreground tabular-nums">
                        R$ {pixData.value.toFixed(2).replace(".", ",")}
                      </span>
                    </div>
                  </div>
                </div>



              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Botão fixo inferior */}
      {!expired && (
        <div className="fixed bottom-0 left-0 right-0 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)] bg-gradient-to-t from-background via-background to-transparent">
          <div className="max-w-md mx-auto">
            <button
              onClick={handleCopy}
              className={cn(
                "w-full h-12 rounded-md font-semibold text-[15px] transition-all active:scale-[0.98]",
                copied
                  ? "bg-emerald-500 text-white"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              {copied ? "Código copiado!" : "Copiar código"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientePixCheckout;
