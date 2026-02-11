import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  ArrowLeft, 
  Check, 
  CreditCard, 
  Copy, 
  CheckCircle2, 
  TrendingDown,
  Sparkles,
  Crown,
  Shield
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import pixIcon from "@/assets/pix-icon.png";

interface Plan {
  id: string;
  nome: string;
  descricao: string;
  preco_mensal: number;
  beneficios_json: any;
  limite_agendamentos_mes: number;
}

// Componente PlanCard Premium
function PlanCard({ 
  plan, 
  isSelected,
  isPopular, 
  onSelect,
  disabled
}: { 
  plan: Plan;
  isSelected: boolean;
  isPopular?: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  const benefits = Array.isArray(plan.beneficios_json) ? plan.beneficios_json : [];
  const isMostPopular = plan.nome.toLowerCase().includes('barba');

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      onClick={() => !disabled && onSelect()}
      className={cn(
        "relative rounded-2xl border transition-all cursor-pointer overflow-hidden",
        isSelected
          ? "border-primary/50 bg-card shadow-lg shadow-primary/5 ring-2 ring-primary/30"
          : isMostPopular
            ? "border-primary/20 bg-card hover:border-primary/40"
            : "border-border/40 bg-card hover:border-border",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {/* Accent line */}
      {(isSelected || isMostPopular) && (
        <div className="h-0.5 bg-gradient-to-r from-primary via-primary/80 to-primary/40" />
      )}

      <div className="p-6">
        {/* Badge mais popular */}
        {isMostPopular && !isSelected && (
          <div className="flex items-center gap-1.5 mb-3">
            <Crown className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-primary">
              Mais Popular
            </span>
          </div>
        )}
        {/* Check de seleção */}
        {isSelected && (
          <div className="absolute top-5 right-5">
            <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center">
              <Check className="w-4 h-4 text-primary-foreground" />
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-4 pr-10">
          <h3 className="text-xl font-bold text-foreground mb-1">
            {plan.nome}
          </h3>
          <p className="text-sm text-muted-foreground">
            {plan.descricao}
          </p>
        </div>

        {/* Preço */}
        <div className="mb-5">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-primary">
              R$ {plan.preco_mensal.toFixed(2).replace('.', ',')}
            </span>
            <span className="text-sm text-muted-foreground">/mês</span>
          </div>
        </div>

        {/* Benefícios */}
        <div className="space-y-2.5 pt-4 border-t border-border/30">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <span className="text-sm text-muted-foreground">
              {plan.limite_agendamentos_mes} agendamentos por mês
            </span>
          </div>
          
          {benefits.map((beneficio: string, index: number) => (
            <div key={index} className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <span className="text-sm text-muted-foreground">{beneficio}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

const ClienteAssinar = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card'>('card');
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  
  // Card payment states
  const [cardHolderName, setCardHolderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiryMonth, setCardExpiryMonth] = useState("");
  const [cardExpiryYear, setCardExpiryYear] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardCep, setCardCep] = useState("");
  
  // PIX payment states
  const [pixQrCode, setPixQrCode] = useState<string | null>(null);
  const [pixPayload, setPixPayload] = useState<string | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [gatewaySubscriptionId, setGatewaySubscriptionId] = useState<string | null>(null);

  useEffect(() => {
    loadPlans();
    checkActiveSubscription();
  }, []);

  // Poll for payment confirmation when showing PIX QR Code
  useEffect(() => {
    if (step === 4 && pixQrCode && gatewaySubscriptionId && !paymentConfirmed) {
      const pollInterval = setInterval(async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return;

          const { data: subscription, error } = await supabase
            .from("assinaturas")
            .select("status")
            .eq("gateway_subscription_id", gatewaySubscriptionId)
            .eq("user_id", session.user.id)
            .maybeSingle();

          if (error) {
            console.error("Error checking subscription:", error);
            return;
          }

          if (subscription && subscription.status === 'active') {
            setPaymentConfirmed(true);
            clearInterval(pollInterval);
            toast.success("Pagamento confirmado!");
            
            setTimeout(() => {
              navigate("/cliente");
            }, 3000);
          }
        } catch (error) {
          console.error("Error polling payment status:", error);
        }
      }, 3000);

      return () => clearInterval(pollInterval);
    }
  }, [step, pixQrCode, gatewaySubscriptionId, paymentConfirmed, navigate]);

  const checkActiveSubscription = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data } = await supabase
      .from('assinaturas')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('status', 'active')
      .maybeSingle();

    setHasActiveSubscription(!!data);
  };

  const loadPlans = async () => {
    const { data } = await supabase
      .from('planos')
      .select('*')
      .eq('ativo', true)
      .order('preco_mensal');

    setPlans(data || []);
  };

  const handleSubscribe = async () => {
    if (!selectedPlan) return;

    if (paymentMethod === 'card') {
      if (!cardHolderName || !cardNumber || !cardExpiryMonth || !cardExpiryYear || !cardCvv || !cardCep) {
        toast.error("Preencha todos os dados do cartão");
        return;
      }
      const cleanCep = cardCep.replace(/\D/g, '');
      if (cleanCep.length !== 8) {
        toast.error("CEP inválido. Informe 8 dígitos.");
        return;
      }
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Você precisa estar logado");
        navigate("/auth");
        return;
      }

      const payload: any = {
        planoId: selectedPlan.id,
        paymentMethod,
      };

      if (paymentMethod === 'card') {
        payload.cardInfo = {
          holderName: cardHolderName.trim(),
          number: cardNumber.replace(/\s/g, ''),
          expiryMonth: cardExpiryMonth.trim(),
          expiryYear: cardExpiryYear.trim(),
          ccv: cardCvv.trim(),
          cep: cardCep.replace(/\D/g, ''),
        };
      }

      const { data, error } = await supabase.functions.invoke('create-subscription', {
        body: payload
      });

      if (error) throw error;

      if (paymentMethod === 'pix' && data.asaasSubscription?.firstPayment?.pixQrCode) {
        setPixQrCode(data.asaasSubscription.firstPayment.pixQrCode.encodedImage);
        setPixPayload(data.asaasSubscription.firstPayment.pixQrCode.payload);
        setGatewaySubscriptionId(data.asaasSubscription.id);
        toast.success("QR Code gerado! Escaneie para pagar.");
        setStep(4);
      } else if (paymentMethod === 'card') {
        const paymentStatus = data.asaasSubscription?.firstPayment?.status;
        if (paymentStatus === 'CONFIRMED' || paymentStatus === 'PENDING') {
          toast.success("Assinatura ativada com sucesso! 🎉");
          navigate("/cliente");
        } else {
          toast.error("Pagamento recusado. Verifique os dados do cartão.");
        }
      }
    } catch (error: any) {
      console.error('Subscription error:', error);
      toast.error("Erro ao criar assinatura: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const copyPixCode = () => {
    if (pixPayload) {
      navigator.clipboard.writeText(pixPayload);
      toast.success("Código PIX copiado!");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-3 bg-background/80 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button 
            onClick={() => step === 1 ? navigate("/cliente") : setStep(step - 1)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-card border border-border/40 hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </button>
          {step === 1 && (
            <motion.p 
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-sm font-semibold text-foreground tracking-tight"
            >
              Escolha o melhor para você
            </motion.p>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        
        {/* Aviso de assinatura ativa */}
        {hasActiveSubscription && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-destructive/10 border border-destructive/30 rounded-xl p-4"
          >
            <p className="text-sm text-destructive">
              Você já possui uma assinatura ativa. Cancele-a antes de assinar outro plano.
            </p>
          </motion.div>
        )}

        {/* Step 1: Seleção de Plano */}
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              {/* Cards de Planos */}
              <div className="space-y-4">
                {plans.map((plan, index) => (
                  <PlanCard 
                    key={plan.id}
                    plan={plan}
                    isSelected={selectedPlan?.id === plan.id}
                    isPopular={index === Math.floor(plans.length / 2)}
                    onSelect={() => setSelectedPlan(plan)}
                    disabled={hasActiveSubscription}
                  />
                ))}
              </div>

              <Button
                onClick={() => setStep(2)}
                disabled={!selectedPlan || hasActiveSubscription}
                className="w-full h-14 text-lg font-semibold bg-primary hover:bg-primary/90"
              >
                Continuar
              </Button>
            </motion.div>
          )}

          {/* Step 2: Método de Pagamento */}
          {step === 2 && selectedPlan && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">Forma de Pagamento</h2>
                <p className="text-sm text-muted-foreground">
                  Escolha como deseja pagar sua assinatura mensal
                </p>
              </div>

              {/* Resumo do plano */}
              <div className="rounded-xl border border-border/40 bg-card p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-foreground">{selectedPlan.nome}</div>
                    <div className="text-sm text-muted-foreground">Cobrança mensal</div>
                  </div>
                  <div className="text-2xl font-bold text-primary">
                    R$ {selectedPlan.preco_mensal.toFixed(2).replace('.', ',')}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {/* Cartão */}
                <motion.div
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "p-4 rounded-xl border cursor-pointer transition-all",
                    paymentMethod === 'card'
                      ? "bg-primary/5 border-primary/40 ring-2 ring-primary/20"
                      : "bg-card border-border/40 hover:border-border"
                  )}
                  onClick={() => setPaymentMethod('card')}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                      paymentMethod === 'card' ? "border-primary" : "border-muted-foreground/40"
                    )}>
                      {paymentMethod === 'card' && (
                        <div className="w-3 h-3 rounded-full bg-primary" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-muted-foreground" />
                        <h4 className="font-semibold text-foreground">Cartão de Crédito</h4>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Cobrança automática mensal
                      </p>
                    </div>
                  </div>
                </motion.div>

                {/* PIX */}
                <motion.div
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "p-4 rounded-xl border cursor-pointer transition-all",
                    paymentMethod === 'pix'
                      ? "bg-primary/5 border-primary/40 ring-2 ring-primary/20"
                      : "bg-card border-border/40 hover:border-border"
                  )}
                  onClick={() => setPaymentMethod('pix')}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                      paymentMethod === 'pix' ? "border-primary" : "border-muted-foreground/40"
                    )}>
                      {paymentMethod === 'pix' && (
                        <div className="w-3 h-3 rounded-full bg-primary" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <img src={pixIcon} alt="PIX" className="w-4 h-4 object-contain" />
                        <h4 className="font-semibold text-foreground">PIX</h4>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Você receberá um QR Code todo mês
                      </p>
                    </div>
                  </div>
                </motion.div>
              </div>

              <Button
                onClick={() => setStep(3)}
                className="w-full h-14 text-lg font-semibold bg-primary hover:bg-primary/90"
              >
                Continuar
              </Button>
            </motion.div>
          )}

          {/* Step 3: Dados de Pagamento */}
          {step === 3 && selectedPlan && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">Dados de Pagamento</h2>
                <p className="text-sm text-muted-foreground">
                  {paymentMethod === 'card' ? 'Preencha os dados do seu cartão' : 'Confirme para gerar o QR Code'}
                </p>
              </div>

              {paymentMethod === 'card' && (
                <div className="bg-card border border-border/40 rounded-xl p-6 space-y-4">
                  <div>
                    <Label htmlFor="cardHolderName" className="text-muted-foreground text-sm">Nome no Cartão</Label>
                    <Input
                      id="cardHolderName"
                      placeholder="Como está no cartão"
                      value={cardHolderName}
                      onChange={(e) => setCardHolderName(e.target.value)}
                      className="bg-muted/50 border-border mt-1.5"
                    />
                  </div>

                  <div>
                    <Label htmlFor="cardNumber" className="text-muted-foreground text-sm">Número do Cartão</Label>
                    <Input
                      id="cardNumber"
                      placeholder="0000 0000 0000 0000"
                      value={cardNumber}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        const formatted = value.replace(/(\d{4})(?=\d)/g, '$1 ');
                        setCardNumber(formatted);
                      }}
                      maxLength={19}
                      className="bg-muted/50 border-border mt-1.5"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label htmlFor="cardExpiryMonth" className="text-muted-foreground text-sm">Mês</Label>
                      <Input
                        id="cardExpiryMonth"
                        placeholder="MM"
                        value={cardExpiryMonth}
                        onChange={(e) => setCardExpiryMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
                        maxLength={2}
                        className="bg-muted/50 border-border mt-1.5"
                      />
                    </div>

                    <div>
                      <Label htmlFor="cardExpiryYear" className="text-muted-foreground text-sm">Ano</Label>
                      <Input
                        id="cardExpiryYear"
                        placeholder="AAAA"
                        value={cardExpiryYear}
                        onChange={(e) => setCardExpiryYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        maxLength={4}
                        className="bg-muted/50 border-border mt-1.5"
                      />
                    </div>

                    <div>
                      <Label htmlFor="cardCvv" className="text-muted-foreground text-sm">CVV</Label>
                      <Input
                        id="cardCvv"
                        placeholder="123"
                        type="password"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        maxLength={4}
                        className="bg-muted/50 border-border mt-1.5"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="cardCep" className="text-muted-foreground text-sm">CEP</Label>
                    <Input
                      id="cardCep"
                      placeholder="00000-000"
                      value={cardCep}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 8);
                        const formatted = value.length > 5 ? `${value.slice(0, 5)}-${value.slice(5)}` : value;
                        setCardCep(formatted);
                      }}
                      maxLength={9}
                      className="bg-muted/50 border-border mt-1.5"
                    />
                  </div>
                </div>
              )}

              {paymentMethod === 'pix' && (
                <div className="bg-card border border-border/40 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-emerald-500/15 rounded-full flex items-center justify-center">
                      <img src={pixIcon} alt="PIX" className="w-5 h-5 object-contain" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">Pagamento PIX</h4>
                      <p className="text-sm text-muted-foreground">Rápido e seguro</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Clique em confirmar para gerar o QR Code PIX para pagamento da sua primeira mensalidade.
                  </p>
                </div>
              )}

              {/* Resumo */}
              <div className="bg-card border border-border/40 rounded-xl p-4 space-y-3">
                <div className="flex justify-between py-2 border-b border-border/30">
                  <span className="text-muted-foreground">Plano:</span>
                  <span className="font-semibold text-foreground">{selectedPlan.nome}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/30">
                  <span className="text-muted-foreground">Forma de Pagamento:</span>
                  <span className="font-semibold text-foreground">
                    {paymentMethod === 'card' ? 'Cartão de Crédito' : 'PIX'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="font-semibold text-foreground">Valor Mensal:</span>
                  <span className="text-2xl font-bold text-primary">
                    R$ {selectedPlan.preco_mensal.toFixed(2).replace('.', ',')}
                  </span>
                </div>
              </div>

              <Button
                onClick={handleSubscribe}
                disabled={loading}
                className="w-full h-14 text-lg font-semibold bg-primary hover:bg-primary/90"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    Processando...
                  </div>
                ) : (
                  "Confirmar Assinatura"
                )}
              </Button>
            </motion.div>
          )}

          {/* Step 4: QR Code PIX */}
          {step === 4 && pixQrCode && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              {paymentConfirmed ? (
                <div className="bg-card border border-emerald-500/30 rounded-2xl p-8 text-center space-y-4">
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex justify-center"
                  >
                    <div className="bg-emerald-500/15 rounded-full p-4">
                      <CheckCircle2 className="w-16 h-16 text-emerald-500" />
                    </div>
                  </motion.div>
                  <div>
                    <h2 className="text-2xl font-bold mb-2 text-foreground">Pagamento Confirmado</h2>
                    <p className="text-muted-foreground">
                      Sua assinatura foi ativada com sucesso!
                    </p>
                  </div>
                </div>
              ) : (
              <>
                  <div className="text-center mb-1">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <img src={pixIcon} alt="PIX" className="w-5 h-5 object-contain" />
                      <h2 className="text-xl font-bold text-foreground">Pagamento PIX</h2>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Use o app do seu banco para pagar
                    </p>
                  </div>

                  <div className="space-y-5">
                    {/* QR Code premium */}
                    <div className="relative">
                      <div className="absolute -top-px left-6 right-6 h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent rounded-full" />
                      
                      <div className="bg-card border border-border/40 rounded-2xl p-5">
                        <div className="relative bg-white rounded-xl p-4 flex justify-center overflow-hidden">
                          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary/25 rounded-tl-xl" />
                          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-primary/25 rounded-tr-xl" />
                          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-primary/25 rounded-bl-xl" />
                          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary/25 rounded-br-xl" />
                          
                          <img
                            src={`data:image/png;base64,${pixQrCode}`}
                            alt="QR Code PIX"
                            className="w-52 h-52 relative z-[1]"
                          />
                        </div>

                        <p className="text-xs text-muted-foreground text-center mt-3">
                          Abra o app do seu banco e escaneie o código acima
                        </p>
                      </div>
                    </div>

                    {pixPayload && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 justify-center">
                          <div className="h-px flex-1 bg-border/40" />
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Ou copie o código
                          </p>
                          <div className="h-px flex-1 bg-border/40" />
                        </div>

                        <Button
                          onClick={copyPixCode}
                          className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90"
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          Copiar Código PIX
                        </Button>

                        <div className="bg-card/50 rounded-xl p-3 border border-border/30">
                          <p className="text-[10px] font-mono text-muted-foreground/70 break-all leading-relaxed line-clamp-2">
                            {pixPayload}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Status */}
                    <div className="flex items-center justify-center gap-3 py-3 px-4 bg-card/50 border border-border/30 rounded-xl">
                      <div className="relative flex items-center justify-center">
                        <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                        <div className="absolute w-4 h-4 bg-primary/20 rounded-full animate-ping" />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Aguardando confirmação do pagamento
                      </p>
                    </div>

                    <div className="flex items-center justify-center gap-1.5 text-muted-foreground/50">
                      <Shield className="w-3 h-3" />
                      <p className="text-[10px]">Pagamento seguro via PIX</p>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ClienteAssinar;
