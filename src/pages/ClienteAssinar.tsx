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
  Sparkles,
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

/** Card de plano compacto e persuasivo */
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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      onClick={() => !disabled && onSelect()}
      className={cn(
        "relative rounded-xl border transition-all cursor-pointer overflow-hidden active:scale-[0.99]",
        isSelected
          ? "border-primary/50 bg-card ring-2 ring-primary/20"
          : isMostPopular
            ? "border-primary/20 bg-card hover:border-primary/40"
            : "border-border/40 bg-card hover:border-border",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {(isSelected || isMostPopular) && (
        <div className="h-0.5 bg-gradient-to-r from-primary via-primary/60 to-transparent" />
      )}

      <div className="p-4">
        {/* Popular badge */}
        {isMostPopular && !isSelected && (
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="w-3 h-3 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
              Mais Popular
            </span>
          </div>
        )}

        {/* Check indicator */}
        {isSelected && (
          <div className="absolute top-4 right-4">
            <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
              <Check className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
          </div>
        )}

        {/* Name + description */}
        <div className="mb-3 pr-8">
          <h3 className="text-base font-bold text-foreground">{plan.nome}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{plan.descricao}</p>
        </div>

        {/* Price */}
        <div className="mb-3">
          <div className="flex items-baseline gap-0.5">
            <span className="text-2xl font-bold text-primary tabular-nums">
              R$ {plan.preco_mensal.toFixed(2).replace('.', ',')}
            </span>
            <span className="text-xs text-muted-foreground">/mês</span>
          </div>
        </div>

        {/* Benefits — compacto */}
        <div className="space-y-1.5 pt-3 border-t border-border/30">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <span className="text-xs text-muted-foreground">
              {plan.limite_agendamentos_mes} agendamentos/mês
            </span>
          </div>
          
          {benefits.slice(0, 3).map((beneficio: string, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <span className="text-xs text-muted-foreground line-clamp-1">{beneficio}</span>
            </div>
          ))}
          {benefits.length > 3 && (
            <p className="text-[10px] text-primary/70 pl-5.5 font-medium">
              +{benefits.length - 3} benefícios
            </p>
          )}
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

  useEffect(() => {
    if (resumePlanId && plans.length > 0 && (step === 0 || step === 1)) {
      const plan = plans.find(p => p.id === resumePlanId);
      if (plan) {
        setSelectedPlan(plan);
        setStep(2);
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

  const handleProceedToPayment = () => {
    if (!selectedPlan) return;
    setStep(2);
  };

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
        const { data, error } = await supabase.functions.invoke('create-subscription-card', {
          body: { planoId: selectedPlan.id }
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        if (data?.url) {
          window.location.href = data.url;
          toast.info("Complete o pagamento para ativar sua assinatura");
        }
      } else {
        const { data, error } = await supabase.functions.invoke('create-subscription-pix', {
          body: { planoId: selectedPlan.id }
        });
        if (error) throw error;
        if (data?.success) {
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

  const headerTitle = step === 1 ? "Escolha seu plano" : "Forma de pagamento";

  return (
    <div className="min-h-screen pb-20">
      
      {/* Header — compacto, seta + título */}
      <div className="sticky top-0 z-10 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 bg-background/80 backdrop-blur-xl">
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
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-card border border-border/40 hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </button>
          <motion.p 
            key={headerTitle}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-sm font-semibold text-foreground tracking-tight"
          >
            {headerTitle}
          </motion.p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 space-y-4">
        
        {/* Aviso assinatura ativa */}
        {hasActiveSubscription && (
          <motion.div 
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-destructive/10 border border-destructive/30 rounded-lg p-3"
          >
            <p className="text-xs text-destructive">
              Você já possui uma assinatura ativa. Cancele-a antes de assinar outro plano.
            </p>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {/* Loading */}
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center py-16"
            >
              <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </motion.div>
          )}

          {/* Step 1: Seleção de Plano */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              className="space-y-3 pb-28"
            >
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
            </motion.div>
          )}

          {/* Step 2: Pagamento */}
          {step === 2 && selectedPlan && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              className="space-y-3 pb-28"
            >
              {/* Resumo compacto */}
              <div className="rounded-xl border border-border/40 bg-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-bold mb-0.5">
                      Plano selecionado
                    </p>
                    <p className="text-sm font-bold text-foreground">{selectedPlan.nome}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-primary tabular-nums">
                      R$ {selectedPlan.preco_mensal.toFixed(2).replace('.', ',')}
                    </p>
                    <p className="text-[10px] text-muted-foreground">/mês</p>
                  </div>
                </div>
              </div>

              {/* Opções de pagamento */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground">
                  Como deseja pagar?
                </p>

                {/* PIX */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedPaymentMethod("pix")}
                  className={cn(
                    "w-full rounded-xl border p-3.5 text-left transition-all active:scale-[0.99]",
                    selectedPaymentMethod === "pix"
                      ? "border-primary/50 bg-card ring-2 ring-primary/20"
                      : "border-border/40 bg-card hover:border-border"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                      selectedPaymentMethod === "pix" ? "bg-primary/15" : "bg-muted/60"
                    )}>
                      <img src={pixIcon} alt="PIX" className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-xs text-foreground">Pix</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Pagamento instantâneo via QR Code
                      </p>
                    </div>
                    {selectedPaymentMethod === "pix" && (
                      <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                </motion.button>

                {/* Cartão */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedPaymentMethod("card")}
                  className={cn(
                    "w-full rounded-xl border p-3.5 text-left transition-all active:scale-[0.99]",
                    selectedPaymentMethod === "card"
                      ? "border-primary/50 bg-card ring-2 ring-primary/20"
                      : "border-border/40 bg-card hover:border-border"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                      selectedPaymentMethod === "card" ? "bg-primary/15" : "bg-muted/60"
                    )}>
                      <CreditCard className={cn(
                        "w-5 h-5 transition-colors",
                        selectedPaymentMethod === "card" ? "text-primary" : "text-muted-foreground"
                      )} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-xs text-foreground">Cartão de Crédito/Débito</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Pagamento seguro via checkout
                      </p>
                    </div>
                    {selectedPaymentMethod === "card" && (
                      <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Bottom Bar — Step 1 */}
      <AnimatePresence>
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
              <div className="absolute -top-10 left-0 right-0 h-10 bg-gradient-to-t from-background to-transparent pointer-events-none" />
              <div 
                className="relative mx-auto max-w-md"
                style={{
                  borderRadius: "14px",
                  background: "hsl(var(--card) / 0.95)",
                  boxShadow: "0 0 0 1px hsl(var(--border) / 0.3), 0 8px 24px -6px rgba(0, 0, 0, 0.4)",
                  backdropFilter: "blur(20px)"
                }}
              >
                <div 
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-[1px]"
                  style={{ background: "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.4), transparent)" }}
                />
                <div className="flex items-center justify-between px-3.5 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div 
                      className="flex items-center justify-center w-8 h-8 rounded-lg"
                      style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.05))" }}
                    >
                      <Crown className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground/60">{selectedPlan.nome}</div>
                      <div className="flex items-baseline gap-0.5 mt-0.5">
                        <span className="text-[10px] text-muted-foreground/50">R$</span>
                        <span className="text-sm font-semibold text-foreground tabular-nums">
                          {selectedPlan.preco_mensal.toFixed(2).replace('.', ',')}
                        </span>
                        <span className="text-[10px] text-muted-foreground/50">/mês</span>
                      </div>
                    </div>
                  </div>
                  <motion.button
                    onClick={handleProceedToPayment}
                    whileTap={{ scale: 0.96 }}
                    className="group flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium text-xs text-primary-foreground bg-primary hover:bg-primary/90 transition-colors"
                  >
                    <span>Continuar</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </motion.button>
                </div>
              </div>
              <div className="h-3" />
            </div>
          </motion.div>
        )}

        {/* Floating Bottom Bar — Step 2 */}
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
              <div className="absolute -top-10 left-0 right-0 h-10 bg-gradient-to-t from-background to-transparent pointer-events-none" />
              <div 
                className="relative mx-auto max-w-md"
                style={{
                  borderRadius: "14px",
                  background: "hsl(var(--card) / 0.95)",
                  boxShadow: "0 0 0 1px hsl(var(--border) / 0.3), 0 8px 24px -6px rgba(0, 0, 0, 0.4)",
                  backdropFilter: "blur(20px)"
                }}
              >
                <div 
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-[1px]"
                  style={{ background: "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.4), transparent)" }}
                />
                <div className="flex items-center justify-between px-3.5 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div 
                      className="flex items-center justify-center w-8 h-8 rounded-lg"
                      style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.05))" }}
                    >
                      {selectedPaymentMethod === "pix" ? (
                        <img src={pixIcon} alt="PIX" className="w-3.5 h-3.5" />
                      ) : (
                        <CreditCard className="w-3.5 h-3.5 text-primary" />
                      )}
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground/60">
                        {selectedPaymentMethod === "pix" ? "Pagar via Pix" : "Pagar via Cartão"}
                      </div>
                      <div className="flex items-baseline gap-0.5 mt-0.5">
                        <span className="text-[10px] text-muted-foreground/50">R$</span>
                        <span className="text-sm font-semibold text-foreground tabular-nums">
                          {selectedPlan?.preco_mensal.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <motion.button
                    onClick={handlePayment}
                    disabled={loading}
                    whileTap={{ scale: 0.96 }}
                    className="group flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium text-xs text-primary-foreground bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <span>Assinar</span>
                        <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
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
