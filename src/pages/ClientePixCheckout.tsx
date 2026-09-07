import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Check, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { BackArrow } from "@/components/ui/back-arrow";
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
  serviceFee?: number;
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
      <div className="min-h-screen bg-[#FBFBFA] flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-neutral-400 animate-spin" />
      </div>
    );
  }

  // Pagamento confirmado
  if (paid) {
    return (
      <div className="min-h-screen bg-[#FBFBFA] flex items-center justify-center px-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="text-center space-y-5 w-full max-w-xs rounded-[28px] bg-white border border-neutral-200/80 p-7 shadow-[0_4px_24px_rgba(0,0,0,0.04)]"
        >
          <div className="relative w-16 h-16 mx-auto">
            <motion.div
              className="absolute inset-0 rounded-full bg-emerald-500/20"
              animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <div className="relative w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
          </div>
          <div>
            <h2 className="text-[20px] font-semibold text-neutral-900 tracking-tight">Pagamento confirmado</h2>
            <p className="text-[13px] text-neutral-500 mt-1">
              Seu agendamento foi confirmado com sucesso.
            </p>
          </div>
          <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-[12px] text-neutral-400">Redirecionando...</p>
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
    <div className="min-h-screen w-full bg-[#FBFBFA] flex flex-col relative">
      {/* Header fixo — Seta + Ajuda (Exata mesma cor sólida do fundo #FBFBFA) */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-[#FBFBFA]">
        <div className="max-w-2xl mx-auto px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3">
          <div className="flex items-center justify-between">
            <button
              onClick={goBack}
              aria-label="Voltar"
              className="w-10 h-10 rounded-full bg-white border border-neutral-200/70 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex items-center justify-center text-neutral-900 active:scale-90 transition-transform cursor-pointer"
            >
              <BackArrow size={20} strokeWidth={2.2} />
            </button>

            <button
              onClick={goBack}
              className="text-neutral-600 text-[13px] font-medium px-4 h-10 rounded-full bg-white border border-neutral-200/70 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex items-center active:scale-95 transition-transform"
            >
              Precisa de ajuda?
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-32 pt-20">
        <div className="max-w-md mx-auto w-full px-5">
          <AnimatePresence mode="wait">
            {expired ? (
              <motion.div
                key="expired"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-center space-y-5 mt-8"
              >
                <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <div>
                  <h2 className="text-[24px] font-semibold text-neutral-900 tracking-tight">Tempo esgotado</h2>
                  <p className="text-[13px] text-neutral-500 mt-1">
                    O tempo para pagamento se encerrou.
                  </p>
                </div>
                <button
                  onClick={handleCancel}
                  className="w-full flex items-center justify-center gap-2 h-[54px] rounded-full font-medium text-[15px] tracking-wide text-white bg-neutral-900 active:scale-[0.98] transition-all duration-300 shadow-[0_8px_30px_rgba(0,0,0,0.12)] mt-8"
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
                className="w-full flex flex-col items-center"
              >
                {/* Title */}
                <div className="mb-2 pt-1 text-center">
                  <h2 className="text-[24px] sm:text-[25px] font-semibold text-neutral-900 tracking-tight leading-tight font-sans">
                    Aguardando Pagamento
                  </h2>
                  <p className="text-[13px] text-neutral-500 mt-1">
                    Copie o código PIX abaixo para finalizar.
                  </p>
                </div>

                {/* Illustration */}
                <div className="flex justify-center pt-2 pb-5">
                  <img
                    src={pixWaitingAsset.url}
                    alt="Aguardando pagamento PIX"
                    width={180}
                    height={180}
                    loading="lazy"
                    className="w-[180px] h-[180px] object-contain drop-shadow-sm"
                  />
                </div>

                {/* Timer (Vermelho) */}
                <div className="flex flex-col items-center mb-6">
                  <p className="text-[12px] font-medium text-neutral-500">
                    O tempo para você pagar acaba em:
                  </p>
                  <p className="text-[32px] font-bold text-red-500 tabular-nums mt-0.5 leading-none tracking-tight">
                    {timeLeft}
                  </p>
                  <div className="mt-2.5 h-1.5 w-[180px] bg-red-100/80 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full transition-[width] duration-500 ease-linear"
                      style={{ width: `${timerPct}%` }}
                    />
                  </div>
                </div>

                {/* Código copia e cola */}
                <div className="w-full mb-4">
                  <p className="text-[13px] font-medium text-neutral-500 mb-2 px-1">
                    Código PIX Copia e Cola
                  </p>
                  <button
                    onClick={handleCopy}
                    className="w-full rounded-[20px] bg-white border border-neutral-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-4 flex items-center justify-between gap-3 active:scale-[0.99] transition-transform text-left"
                  >
                    <span className="flex-1 text-[13px] font-medium text-neutral-700 truncate font-mono">
                      {codePreview}
                    </span>
                    <div className={cn(
                      "flex-shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-semibold flex items-center gap-1.5 transition-colors",
                      copied ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-neutral-100 text-neutral-800"
                    )}>
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copiar
                        </>
                      )}
                    </div>
                  </button>
                </div>

                {/* Resumo do Pedido (Estilo Order Summary da referência) */}
                <div className="w-full mb-6">
                  <p className="text-[13px] font-medium text-neutral-500 mb-2 px-1">
                    Resumo do Pedido
                  </p>
                  <div className="rounded-[20px] bg-white border border-neutral-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-4 space-y-3">
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-neutral-500">Profissional</span>
                      <span className="text-neutral-900 font-medium">{pixData.barberName || "Barbearia"}</span>
                    </div>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-neutral-500">Serviço</span>
                      <span className="text-neutral-900 font-medium">{pixData.serviceName ?? "Agendamento"}</span>
                    </div>
                    {pixData.bookingDate && pixData.bookingTime && (
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="text-neutral-500">Data e Horário</span>
                        <span className="text-neutral-900 font-medium">{pixData.bookingDate} às {pixData.bookingTime}</span>
                      </div>
                    )}
                    {pixData.serviceFee && pixData.serviceFee > 0 ? (
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="text-neutral-500">Taxa de serviço</span>
                        <span className="text-neutral-900 font-medium tabular-nums">
                          R$ {pixData.serviceFee.toFixed(2).replace(".", ",")}
                        </span>
                      </div>
                    ) : null}

                    <div className="border-b border-dashed border-neutral-200 my-2" />

                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-[14px] font-medium text-neutral-900">Total a pagar</span>
                      <span className="text-[18px] font-bold text-neutral-900 tabular-nums">
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

      {/* Botão fixo inferior com fade suave */}
      {!expired && (
        <div className="fixed bottom-0 left-0 right-0 z-40">
          <div 
            className="h-16 pointer-events-none"
            style={{ background: "linear-gradient(to bottom, transparent, #FBFBFA)" }}
          />
          <div className="bg-[#FBFBFA] px-5 pb-safe">
            <div className="pt-2 pb-5 max-w-md mx-auto">
              <button
                onClick={handleCopy}
                className={cn(
                  "w-full flex items-center justify-center gap-2 h-[54px] rounded-full font-medium text-[15px] tracking-wide text-white active:scale-[0.98] transition-all duration-300 shadow-[0_8px_30px_rgba(0,0,0,0.12)]",
                  copied
                    ? "bg-emerald-600"
                    : "bg-neutral-900"
                )}
              >
                {copied ? "Código copiado!" : "Copiar código PIX"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientePixCheckout;
