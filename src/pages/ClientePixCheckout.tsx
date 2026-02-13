import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Copy, Check, Loader2, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

/**
 * Tela de checkout PIX com QR Code gerado pelo Asaas.
 * Exibe QR Code, copia-e-cola, timer de expiração e polling de status.
 */
const ClientePixCheckout = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [pixData, setPixData] = useState<{
    pixQrCode: string;
    pixPayload: string;
    pendingBookingId: string;
    asaasPaymentId: string;
    expiresAt: string;
    value: number;
  } | null>(null);

  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
  const [expired, setExpired] = useState(false);
  const [paid, setPaid] = useState(false);
  const [checking, setChecking] = useState(false);

  // Recuperar dados do PIX do sessionStorage
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
      const now = new Date().getTime();
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

  // Polling para verificar pagamento (a cada 5s)
  useEffect(() => {
    if (!pixData?.pendingBookingId || paid || expired) return;

    const pollInterval = setInterval(async () => {
      try {
        // Verificar se o pending_booking ainda existe (se não, pagamento foi confirmado)
        const { data: pb } = await supabase
          .from("pending_bookings")
          .select("id")
          .eq("id", pixData.pendingBookingId)
          .maybeSingle();

        // Se não existe mais, o webhook do Asaas processou o pagamento
        if (!pb) {
          setPaid(true);
          clearInterval(pollInterval);
          sessionStorage.removeItem("pix_checkout_data");
          toast.success("Pagamento confirmado! 🎉");
          setTimeout(() => navigate("/cliente"), 3000);
          return;
        }

        // Verificar se já existe agendamento com este pending_booking
        const { data: apt } = await supabase
          .from("agendamentos")
          .select("id")
          .eq("user_id", (await supabase.auth.getUser()).data.user?.id || "")
          .eq("data", new Date().toISOString().split("T")[0])
          .order("created_at", { ascending: false })
          .limit(1);

      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [pixData?.pendingBookingId, paid, expired, navigate]);

  /** Copia o código PIX */
  const handleCopy = useCallback(async () => {
    if (!pixData?.pixPayload) return;
    try {
      await navigator.clipboard.writeText(pixData.pixPayload);
      setCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error("Erro ao copiar. Tente selecionar manualmente.");
    }
  }, [pixData?.pixPayload]);

  /** Verificar manualmente */
  const handleCheckPayment = async () => {
    if (!pixData?.asaasPaymentId) return;
    setChecking(true);
    try {
      const { data: pb } = await supabase
        .from("pending_bookings")
        .select("id")
        .eq("id", pixData.pendingBookingId)
        .maybeSingle();

      if (!pb) {
        setPaid(true);
        sessionStorage.removeItem("pix_checkout_data");
        toast.success("Pagamento confirmado! 🎉");
        setTimeout(() => navigate("/cliente"), 3000);
      } else {
        toast.info("Pagamento ainda não confirmado. Aguarde...");
      }
    } catch {
      toast.error("Erro ao verificar pagamento.");
    } finally {
      setChecking(false);
    }
  };

  // Loading
  if (!pixData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // Pagamento confirmado
  if (paid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-4"
        >
          <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Pagamento Confirmado!</h2>
          <p className="text-sm text-muted-foreground">
            Seu agendamento foi registrado com sucesso.
          </p>
          <p className="text-xs text-muted-foreground">Redirecionando...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-3 border-b border-border/30">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button
            onClick={() => {
              sessionStorage.removeItem("pix_checkout_data");
              navigate("/cliente/agendar");
            }}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted/50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </button>
          <p className="text-sm font-semibold text-foreground tracking-tight">
            Pagamento via PIX
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-5">
        {/* Timer */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border ${
            expired
              ? "bg-destructive/10 border-destructive/20"
              : "bg-yellow-500/10 border-yellow-500/20"
          }`}
        >
          {expired ? (
            <AlertCircle className="w-4 h-4 text-destructive" />
          ) : (
            <Clock className="w-4 h-4 text-yellow-600" />
          )}
          <span className={`text-sm font-semibold ${expired ? "text-destructive" : "text-yellow-700"}`}>
            {expired ? "QR Code expirado" : `Expira em ${timeLeft}`}
          </span>
        </motion.div>

        {/* Valor */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            Valor a pagar
          </p>
          <p className="text-3xl font-bold text-foreground mt-1">
            R$ {pixData.value.toFixed(2).replace(".", ",")}
          </p>
        </div>

        {/* QR Code */}
        {!expired && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex justify-center"
          >
            <div className="bg-white rounded-2xl p-4 shadow-lg border border-border/30">
              <img
                src={`data:image/png;base64,${pixData.pixQrCode}`}
                alt="QR Code PIX"
                className="w-56 h-56 sm:w-64 sm:h-64"
              />
            </div>
          </motion.div>
        )}

        {/* Copia e cola */}
        {!expired && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground text-center font-medium">
              Ou copie o código PIX
            </p>
            <div className="relative">
              <div className="w-full rounded-xl border border-border/40 bg-card p-3 pr-14 text-xs text-muted-foreground break-all font-mono leading-relaxed max-h-20 overflow-y-auto">
                {pixData.pixPayload}
              </div>
              <button
                onClick={handleCopy}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4 text-primary" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Verificar pagamento */}
        {!expired && (
          <Button
            onClick={handleCheckPayment}
            disabled={checking}
            variant="default"
            className="w-full h-12 rounded-xl font-semibold"
          >
            {checking ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verificando...
              </>
            ) : (
              "Já paguei, verificar"
            )}
          </Button>
        )}

        {/* Expirado */}
        {expired && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              O tempo para pagamento expirou. Volte e tente novamente.
            </p>
            <Button
              onClick={() => {
                sessionStorage.removeItem("pix_checkout_data");
                navigate("/cliente/agendar");
              }}
              variant="default"
              className="h-11 px-8 rounded-xl"
            >
              Voltar para agendamento
            </Button>
          </div>
        )}

        {/* Instrução */}
        {!expired && (
          <div className="rounded-xl bg-muted/50 border border-border/30 p-4 space-y-2">
            <p className="text-xs font-semibold text-foreground">Como pagar:</p>
            <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
              <li>Abra o app do seu banco</li>
              <li>Escaneie o QR Code acima ou cole o código</li>
              <li>Confirme o pagamento</li>
              <li>Aguarde a confirmação automática aqui</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientePixCheckout;
