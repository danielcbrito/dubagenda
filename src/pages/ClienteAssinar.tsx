import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  ArrowRight,
  Check, 
  CheckCircle2, 
  Crown,
  CreditCard,
  Loader2,
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

/** Card de plano premium */
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
      {(isSelected || isMostPopular) && (
        <div className="h-0.5 bg-gradient-to-r from-primary via-primary/80 to-primary/40" />
      )}

      <div className="p-6">
        {isMostPopular && !isSelected && (
          <div className="flex items-center gap-1.5 mb-3">
            <Crown className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-primary">
              Mais Popular
            </span>
          </div>
        )}
        {isSelected && (
          <div className="absolute top-5 right-5">
            <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center">
              <Check className="w-4 h-4 text-primary-foreground" />
            </div>
          </div>
        )}

        <div className="mb-4 pr-10">
          <h3 className="text-xl font-bold text-foreground mb-1">{plan.nome}</h3>
          <p className="text-sm text-muted-foreground">{plan.descricao}</p>
        </div>

        <div className="mb-5">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-primary">
              R$ {plan.preco_mensal.toFixed(2).replace('.', ',')}
            </span>
            <span className="text-sm text-muted-foreground">/mês</span>
          </div>
        </div>

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
  const location = useLocation();
  const resumePlanId = (location.state as any)?.resumePlanId as string | undefined;
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(resumePlanId ? 0 : 1);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"pix" | "card" | null>(null);

  useEffect(() => {
    loadPlans();
    checkActiveSubscription();
  }, []);

  // Se veio com resumePlanId, auto-seleciona o plano e vai direto para pagamento
  useEffect(() => {
    if (resumePlanId && plans.length > 0 && (step === 0 || step === 1)) {
      const plan = plans.find(p => p.id === resumePlanId);
      if (plan) {
        setSelectedPlan(plan);
        setStep(2); // Ir direto para escolha de pagamento
      } else {
        setStep(1);
      }
    } else if (step === 0 && plans.length > 0 && !resumePlanId) {
      setStep(1);
    }
  }, [resumePlanId, plans]);

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

  /** Avançar para pagamento */
  const handleProceedToPayment = () => {
    if (!selectedPlan) return;
    setStep(2);
  };

  /** Finalizar pagamento com o método escolhido */
  const handlePayment = async () => {
    if (!selectedPlan || !selectedPaymentMethod) return;
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Você precisa estar logado");
        navigate("/auth");
        return;
      }

      if (selectedPaymentMethod === "card") {
        // Stripe Checkout
        const { data, error } = await supabase.functions.invoke('create-checkout', {
          body: { planoId: selectedPlan.id }
        });

        if (error) throw error;
        
        if (data?.url) {
          window.open(data.url, '_blank');
          toast.info("Complete o pagamento na nova aba para ativar sua assinatura");
        }
      } else {
        // PIX via Asaas
        const { data, error } = await supabase.functions.invoke('create-subscription-pix', {
          body: { planoId: selectedPlan.id }
        });

        if (error) throw error;

        if (data?.success) {
          // Salvar dados do PIX e redirecionar para checkout PIX
          const pixCheckoutData = {
            pixQrCode: data.pixQrCode,
            pixPayload: data.pixPayload,
            subscriptionId: data.subscriptionId,
            asaasPaymentId: data.asaasPaymentId,
            expiresAt: data.expiresAt,
            value: data.value,
            planName: data.planName,
          };
          sessionStorage.setItem("subscription_pix_checkout_data", JSON.stringify(pixCheckoutData));
          navigate("/cliente/assinatura-pix");
        }
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      toast.error(error.message || "Erro ao processar pagamento");
    } finally {
      setLoading(false);
    }
  };

  /** Título do header conforme o step */
  const headerTitle = step === 1 ? "Escolha o melhor para você" : "Forma de pagamento";

  return (
    <div className="min-h-screen bg-background pb-20">
      
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-3 bg-background/80 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button 
            onClick={() => {
              if (step === 2) {
                setStep(1);
                setSelectedPaymentMethod(null);
              } else {
                navigate("/cliente");
              }
            }}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-card border border-border/40 hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </button>
          <motion.p 
            key={headerTitle}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-sm font-semibold text-foreground tracking-tight"
          >
            {headerTitle}
          </motion.p>
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

        <AnimatePresence mode="wait">
          {/* Loading state */}
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center py-20"
            >
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </motion.div>
          )}

          {/* Step 1: Seleção de Plano */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4 pb-28"
            >
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
            </motion.div>
          )}

          {/* Step 2: Escolha de Forma de Pagamento */}
          {step === 2 && selectedPlan && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5 pb-28"
            >
              {/* Resumo do plano selecionado */}
              <div className="rounded-2xl border border-border/40 bg-card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">
                      Plano selecionado
                    </p>
                    <p className="text-lg font-bold text-foreground">{selectedPlan.nome}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">
                      R$ {selectedPlan.preco_mensal.toFixed(2).replace('.', ',')}
                    </p>
                    <p className="text-xs text-muted-foreground">/mês</p>
                  </div>
                </div>
              </div>

              {/* Opções de pagamento */}
              <div className="space-y-3">
                <p className="text-sm font-semibold text-foreground">
                  Como deseja pagar?
                </p>

                {/* PIX - Temporariamente indisponível */}
                <div
                  className="w-full rounded-2xl border p-5 text-left border-border/20 bg-card/50 opacity-50 cursor-not-allowed"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-muted/40">
                      <img src={pixIcon} alt="PIX" className="w-6 h-6 grayscale" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-muted-foreground">Pix</p>
                      <p className="text-xs text-muted-foreground/70 mt-0.5">
                        Temporariamente indisponível
                      </p>
                    </div>
                  </div>
                </div>

                {/* Cartão */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedPaymentMethod("card")}
                  className={cn(
                    "w-full rounded-2xl border p-5 text-left transition-all",
                    selectedPaymentMethod === "card"
                      ? "border-primary/50 bg-card ring-2 ring-primary/30"
                      : "border-border/40 bg-card hover:border-border"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                      selectedPaymentMethod === "card" ? "bg-primary/15" : "bg-muted/60"
                    )}>
                      <CreditCard className={cn(
                        "w-6 h-6 transition-colors",
                        selectedPaymentMethod === "card" ? "text-primary" : "text-muted-foreground"
                      )} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-foreground">Cartão de Crédito</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Pagamento seguro via Stripe
                      </p>
                    </div>
                    {selectedPaymentMethod === "card" && (
                      <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Bottom Bar */}
      <AnimatePresence>
        {/* Step 1 — Avançar para pagamento */}
        {step === 1 && selectedPlan && !hasActiveSubscription && (
          <motion.div
            key="bar-step1"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 40 }}
            className="fixed bottom-0 left-0 right-0 z-40"
          >
            <div className="relative px-4 pb-safe">
              <div className="absolute -top-12 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none" />
              <div 
                className="relative mx-auto max-w-md"
                style={{
                  borderRadius: "16px",
                  background: "rgba(18, 18, 20, 0.95)",
                  boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.08), 0 8px 32px -8px rgba(0, 0, 0, 0.6), 0 4px 16px -4px rgba(239, 68, 68, 0.1)",
                  backdropFilter: "blur(20px)"
                }}
              >
                <div 
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-[1px]"
                  style={{ background: "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.5), transparent)" }}
                />
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div 
                      className="flex items-center justify-center w-9 h-9 rounded-xl"
                      style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.05))" }}
                    >
                      <Crown className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground/60">{selectedPlan.nome}</div>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-[10px] text-muted-foreground/50">R$</span>
                        <span className="text-base font-semibold text-foreground">
                          {selectedPlan.preco_mensal.toFixed(2).replace('.', ',')}
                        </span>
                        <span className="text-[10px] text-muted-foreground/50">/mês</span>
                      </div>
                    </div>
                  </div>
                  <motion.button
                    onClick={handleProceedToPayment}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="group flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm text-white"
                    style={{
                      background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(0 65% 42%) 100%)",
                      boxShadow: "0 2px 12px hsl(var(--primary) / 0.35), inset 0 1px 0 rgba(255,255,255,0.15)"
                    }}
                  >
                    <span>Continuar</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </motion.button>
                </div>
              </div>
              <div className="h-3" />
            </div>
          </motion.div>
        )}

        {/* Step 2 — Confirmar pagamento */}
        {step === 2 && selectedPaymentMethod && !hasActiveSubscription && (
          <motion.div
            key="bar-step2"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 40 }}
            className="fixed bottom-0 left-0 right-0 z-40"
          >
            <div className="relative px-4 pb-safe">
              <div className="absolute -top-12 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none" />
              <div 
                className="relative mx-auto max-w-md"
                style={{
                  borderRadius: "16px",
                  background: "rgba(18, 18, 20, 0.95)",
                  boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.08), 0 8px 32px -8px rgba(0, 0, 0, 0.6), 0 4px 16px -4px rgba(239, 68, 68, 0.1)",
                  backdropFilter: "blur(20px)"
                }}
              >
                <div 
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-[1px]"
                  style={{ background: "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.5), transparent)" }}
                />
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div 
                      className="flex items-center justify-center w-9 h-9 rounded-xl"
                      style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.05))" }}
                    >
                      {selectedPaymentMethod === "pix" ? (
                        <img src={pixIcon} alt="PIX" className="w-4 h-4" />
                      ) : (
                        <CreditCard className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground/60">
                        {selectedPaymentMethod === "pix" ? "Pagar via Pix" : "Pagar via Cartão"}
                      </div>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-[10px] text-muted-foreground/50">R$</span>
                        <span className="text-base font-semibold text-foreground">
                          {selectedPlan?.preco_mensal.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <motion.button
                    onClick={handlePayment}
                    disabled={loading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="group flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm text-white disabled:opacity-50"
                    style={{
                      background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(0 65% 42%) 100%)",
                      boxShadow: "0 2px 12px hsl(var(--primary) / 0.35), inset 0 1px 0 rgba(255,255,255,0.15)"
                    }}
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Assinar</span>
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
              <div className="h-3" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ClienteAssinar;
