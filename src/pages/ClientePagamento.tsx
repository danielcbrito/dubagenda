import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  CreditCard,
  Check,
  Shield,
  Loader2,
  AlertCircle,
  RefreshCw,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import pixIcon from "@/assets/pix-icon.png";

interface CardInfo {
  brand: string | null;
  lastFourDigits: string | null;
  holderName: string | null;
}

interface SubscriptionInfo {
  id: string;
  status: string;
  payment_method: string | null;
  next_billing_date: string | null;
  gateway_subscription_id: string | null;
  has_gateway: boolean;
  plano: {
    nome: string;
    preco_mensal: number;
  };
}

/**
 * Tela de gerenciamento de formas de pagamento da assinatura
 */
const ClientePagamento = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [cardInfo, setCardInfo] = useState<CardInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Estados para troca de cartão
  const [showCardForm, setShowCardForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cardHolderName, setCardHolderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiryMonth, setCardExpiryMonth] = useState("");
  const [cardExpiryYear, setCardExpiryYear] = useState("");
  const [cardCvv, setCardCvv] = useState("");

  // Estado para troca para PIX
  const [changingToPix, setChangingToPix] = useState(false);

  useEffect(() => {
    loadPaymentInfo();
  }, []);

  const loadPaymentInfo = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "manage-subscription-payment",
        { body: { action: "get" } }
      );

      if (fnError) throw fnError;

      if (data?.subscription) {
        setSubscription(data.subscription);
        setCardInfo(data.cardInfo || null);
      } else {
        setError("Nenhuma assinatura ativa encontrada.");
      }
    } catch (err: any) {
      console.error("Error loading payment info:", err);
      setError(err.message || "Erro ao carregar informações de pagamento.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCard = async () => {
    if (!cardHolderName || !cardNumber || !cardExpiryMonth || !cardExpiryYear || !cardCvv) {
      toast.error("Preencha todos os dados do cartão");
      return;
    }

    setSaving(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "manage-subscription-payment",
        {
          body: {
            action: "update",
            changeToMethod: "card",
            cardInfo: {
              holderName: cardHolderName.trim(),
              number: cardNumber.replace(/\s/g, ""),
              expiryMonth: cardExpiryMonth.trim(),
              expiryYear: cardExpiryYear.trim(),
              ccv: cardCvv.trim(),
            },
          },
        }
      );

      if (fnError) throw fnError;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      toast.success("Cartão atualizado com sucesso!");
      setShowCardForm(false);
      resetCardForm();
      loadPaymentInfo();
    } catch (err: any) {
      console.error("Error updating card:", err);
      toast.error(err.message || "Erro ao atualizar cartão");
    } finally {
      setSaving(false);
    }
  };

  const handleChangeToPix = async () => {
    setChangingToPix(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "manage-subscription-payment",
        {
          body: { action: "update", changeToMethod: "pix" },
        }
      );

      if (fnError) throw fnError;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      toast.success("Forma de pagamento alterada para PIX!");
      loadPaymentInfo();
    } catch (err: any) {
      console.error("Error changing to PIX:", err);
      toast.error(err.message || "Erro ao alterar para PIX");
    } finally {
      setChangingToPix(false);
    }
  };

  const resetCardForm = () => {
    setCardHolderName("");
    setCardNumber("");
    setCardExpiryMonth("");
    setCardExpiryYear("");
    setCardCvv("");
  };

  /** Retorna o label da bandeira do cartão */
  const getBrandLabel = (brand: string | null) => {
    if (!brand) return "Cartão";
    const brands: Record<string, string> = {
      VISA: "Visa",
      MASTERCARD: "Mastercard",
      ELO: "Elo",
      AMEX: "American Express",
      HIPERCARD: "Hipercard",
      DINERS: "Diners",
    };
    return brands[brand.toUpperCase()] || brand;
  };

  /** Retorna cores visuais baseadas na bandeira/banco */
  const getBrandColors = (brand: string | null): { bg: string; accent: string; text: string } => {
    if (!brand) return { bg: "from-zinc-700 to-zinc-900", accent: "bg-white/10", text: "text-white" };
    const key = brand.toUpperCase();
    const map: Record<string, { bg: string; accent: string; text: string }> = {
      VISA: { bg: "from-blue-700 to-blue-900", accent: "bg-blue-400/20", text: "text-blue-100" },
      MASTERCARD: { bg: "from-orange-600 to-red-800", accent: "bg-orange-400/20", text: "text-orange-100" },
      ELO: { bg: "from-yellow-500 to-yellow-700", accent: "bg-yellow-300/20", text: "text-yellow-100" },
      AMEX: { bg: "from-sky-600 to-sky-900", accent: "bg-sky-400/20", text: "text-sky-100" },
      HIPERCARD: { bg: "from-red-600 to-red-800", accent: "bg-red-400/20", text: "text-red-100" },
      DINERS: { bg: "from-slate-600 to-slate-800", accent: "bg-slate-400/20", text: "text-slate-100" },
    };
    return map[key] || { bg: "from-zinc-700 to-zinc-900", accent: "bg-white/10", text: "text-white" };
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate("/cliente")}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted/50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </button>
          <p className="text-sm font-semibold text-foreground tracking-tight">
            Formas de Pagamento
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center pt-20 gap-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Carregando...</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center pt-20 gap-6">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-foreground">Erro</p>
              <p className="text-xs text-muted-foreground max-w-xs">{error}</p>
            </div>
            <Button onClick={loadPaymentInfo} variant="default" className="h-11 px-6">
              <RefreshCw className="w-4 h-4 mr-2" />
              Tentar Novamente
            </Button>
          </div>
        )}

        {/* Content */}
        {!loading && !error && subscription && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            {/* Plano resumo */}
            <div className="rounded-2xl border border-border/40 bg-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">
                    Plano atual
                  </p>
                  <p className="text-lg font-bold text-foreground">
                    {subscription.plano.nome}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">
                    R$ {Number(subscription.plano.preco_mensal).toFixed(2).replace(".", ",")}
                  </p>
                  <p className="text-xs text-muted-foreground">/mês</p>
                </div>
              </div>
            </div>

            {/* Método de pagamento atual */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                Método de pagamento ativo
              </h3>

              {subscription.payment_method === "card" && cardInfo ? (
                <div className="space-y-3">
                  {/* Visual card representation */}
                  <div className={cn(
                    "relative rounded-2xl p-5 overflow-hidden bg-gradient-to-br shadow-lg",
                    getBrandColors(cardInfo.brand).bg
                  )}>
                    {/* Decorative circles */}
                    <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/5" />
                    <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-white/5" />

                    <div className="relative z-10 flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <CreditCard className="w-7 h-7 text-white/80" />
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm">
                          <Check className="w-3 h-3 text-white" />
                          <span className="text-[11px] font-semibold text-white">Ativo</span>
                        </div>
                      </div>

                      <p className="text-lg tracking-[0.25em] font-mono text-white/90 pt-2">
                        •••• •••• •••• {cardInfo.lastFourDigits || "****"}
                      </p>

                      <div className="flex items-end justify-between pt-1">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-white/50 mb-0.5">Titular</p>
                          <p className="text-xs font-medium text-white/90 truncate max-w-[180px]">
                            {cardInfo.holderName || "—"}
                          </p>
                        </div>
                        <p className="text-sm font-bold text-white/90">
                          {getBrandLabel(cardInfo.brand)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Débito automático badge */}
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted/50 border border-border/30">
                    <RefreshCw className="w-3.5 h-3.5 text-primary" />
                    <p className="text-xs text-muted-foreground">
                      Cobrança automática ativada — renovação mensal
                    </p>
                  </div>
                </div>
              ) : subscription.payment_method === "pix" ? (
                <div className="rounded-2xl border border-border/40 bg-card p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                        <img src={pixIcon} alt="PIX" className="w-6 h-6 object-contain" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">PIX</p>
                        <p className="text-sm text-muted-foreground">
                          QR Code gerado todo mês
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10">
                      <Check className="w-3 h-3 text-primary" />
                      <span className="text-[11px] font-semibold text-primary">Ativo</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-border/40 bg-card p-5">
                  <p className="text-sm text-muted-foreground">
                    Nenhuma forma de pagamento cadastrada.
                  </p>
                </div>
              )}
            </div>

            {/* Ações */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Alterar forma de pagamento</h3>

              {/* Botão trocar/cadastrar cartão */}
              <button
                onClick={() => {
                  resetCardForm();
                  setShowCardForm(!showCardForm);
                }}
                className={cn(
                  "w-full rounded-2xl border p-5 text-left transition-all group",
                  showCardForm
                    ? "bg-primary/5 border-primary/30 shadow-sm"
                    : "bg-card border-border/40 hover:border-primary/20 hover:shadow-md"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                    showCardForm
                      ? "bg-primary/15"
                      : "bg-muted/60 group-hover:bg-primary/10"
                  )}>
                    {subscription.payment_method === "card" ? (
                      <Pencil className={cn("w-5 h-5 transition-colors", showCardForm ? "text-primary" : "text-muted-foreground group-hover:text-primary")} />
                    ) : (
                      <CreditCard className={cn("w-5 h-5 transition-colors", showCardForm ? "text-primary" : "text-muted-foreground group-hover:text-primary")} />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-foreground">
                      {subscription.payment_method === "card"
                        ? "Trocar cartão"
                        : "Cadastrar cartão de crédito"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {subscription.payment_method === "card"
                        ? "Substituir o cartão cadastrado"
                        : "Ative o débito automático mensal"}
                    </p>
                  </div>
                  <ArrowLeft className={cn(
                    "w-4 h-4 rotate-180 text-muted-foreground/40 transition-transform",
                    showCardForm && "rotate-90"
                  )} />
                </div>
              </button>

              {/* Formulário de cartão */}
              <AnimatePresence>
                {showCardForm && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-card border border-border/40 rounded-xl p-5 space-y-4">
                      <div>
                        <Label htmlFor="cardHolderName" className="text-muted-foreground text-sm">
                          Nome no Cartão
                        </Label>
                        <Input
                          id="cardHolderName"
                          placeholder="Como está no cartão"
                          value={cardHolderName}
                          onChange={(e) => setCardHolderName(e.target.value)}
                          className="bg-muted/50 border-border mt-1.5"
                        />
                      </div>

                      <div>
                        <Label htmlFor="cardNumber" className="text-muted-foreground text-sm">
                          Número do Cartão
                        </Label>
                        <Input
                          id="cardNumber"
                          placeholder="0000 0000 0000 0000"
                          value={cardNumber}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, "");
                            const formatted = value.replace(/(\d{4})(?=\d)/g, "$1 ");
                            setCardNumber(formatted);
                          }}
                          maxLength={19}
                          className="bg-muted/50 border-border mt-1.5"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label className="text-muted-foreground text-sm">Mês</Label>
                          <Input
                            placeholder="MM"
                            value={cardExpiryMonth}
                            onChange={(e) =>
                              setCardExpiryMonth(e.target.value.replace(/\D/g, "").slice(0, 2))
                            }
                            maxLength={2}
                            className="bg-muted/50 border-border mt-1.5"
                          />
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-sm">Ano</Label>
                          <Input
                            placeholder="AAAA"
                            value={cardExpiryYear}
                            onChange={(e) =>
                              setCardExpiryYear(e.target.value.replace(/\D/g, "").slice(0, 4))
                            }
                            maxLength={4}
                            className="bg-muted/50 border-border mt-1.5"
                          />
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-sm">CVV</Label>
                          <Input
                            placeholder="123"
                            type="password"
                            value={cardCvv}
                            onChange={(e) =>
                              setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))
                            }
                            maxLength={4}
                            className="bg-muted/50 border-border mt-1.5"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-muted-foreground/60 mt-2">
                        <Shield className="w-3 h-3" />
                        <p className="text-[10px]">
                          Seus dados são criptografados e processados com segurança
                        </p>
                      </div>

                      <Button
                        onClick={handleUpdateCard}
                        disabled={saving}
                        className="w-full h-12 font-semibold bg-primary hover:bg-primary/90"
                      >
                        {saving ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Salvando...
                          </div>
                        ) : (
                          "Salvar Cartão"
                        )}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Botão trocar para PIX (só aparece se está usando cartão) */}
              {subscription.payment_method === "card" && (
                <button
                  onClick={handleChangeToPix}
                  disabled={changingToPix}
                  className="w-full rounded-xl border border-border/40 bg-card hover:border-border p-4 text-left transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center">
                      <img src={pixIcon} alt="PIX" className="w-5 h-5 object-contain" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-foreground">Usar PIX mensal</p>
                      <p className="text-xs text-muted-foreground">
                        Receber QR Code todo mês para pagamento
                      </p>
                    </div>
                    {changingToPix && (
                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    )}
                  </div>
                </button>
              )}

              {/* Dica para quem usa PIX */}
              {subscription.payment_method === "pix" && !showCardForm && (
                <p className="text-xs text-center text-muted-foreground pt-2">
                  Cadastre um cartão acima para ativar a cobrança automática
                </p>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default ClientePagamento;
