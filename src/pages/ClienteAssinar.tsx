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
  Shield,
  Sparkles,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import pixIcon from "@/assets/pix-icon.png";
import { BarberCard } from "@/components/booking/BarberCard";
import { useBarberRatings } from "@/hooks/useBarberRatings";

interface Plan {
  id: string;
  nome: string;
  descricao: string;
  preco_mensal: number;
  beneficios_json: any;
  limite_agendamentos_mes: number;
}

interface Barber {
  id: string;
  apelido: string;
  foto_url: string | null;
}

/** Card de plano — premium, moderno e persuasivo */
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
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      onClick={() => !disabled && onSelect()}
      className={cn(
        "relative rounded-2xl border-2 transition-all cursor-pointer overflow-hidden",
        isSelected
          ? "border-primary bg-primary/[0.03] shadow-[0_0_24px_-4px_hsl(var(--primary)/0.15)]"
          : isMostPopular
            ? "border-primary/30 bg-card hover:border-primary/50 hover:shadow-md"
            : "border-border/50 bg-card hover:border-border hover:shadow-sm",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {/* Top accent */}
      {(isSelected || isMostPopular) && (
        <div className="h-1 bg-gradient-to-r from-primary via-primary/70 to-primary/20" />
      )}

      <div className="p-5">
        {isMostPopular && (
          <div className="flex items-center gap-1.5 mb-3">
            <div className="flex items-center gap-1.5 bg-primary/10 px-2.5 py-1 rounded-full">
              <Sparkles className="w-3 h-3 text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                Mais Popular
              </span>
            </div>
          </div>
        )}

        {isSelected && (
          <div className="absolute top-5 right-5">
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-7 h-7 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/30"
            >
              <Check className="w-4 h-4 text-primary-foreground" strokeWidth={3} />
            </motion.div>
          </div>
        )}

        <div className="mb-4 pr-10">
          <h3 className="text-lg font-bold text-foreground tracking-tight">{plan.nome}</h3>
          <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed line-clamp-2">{plan.descricao}</p>
        </div>

        <div className="mb-4">
          <div className="flex items-baseline gap-1">
            <span className="text-[11px] text-muted-foreground font-medium">R$</span>
            <span className="text-3xl font-extrabold text-primary tabular-nums tracking-tight">
              {plan.preco_mensal.toFixed(2).replace('.', ',')}
            </span>
            <span className="text-[11px] text-muted-foreground font-medium">/mês</span>
          </div>
        </div>

        <div className="space-y-2.5 pt-4 border-t border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-3 h-3 text-primary" />
            </div>
            <span className="text-[13px] text-foreground font-medium">
              {plan.limite_agendamentos_mes} agendamentos/mês
            </span>
          </div>
          
          {benefits.slice(0, 4).map((beneficio: string, index: number) => (
            <div key={index} className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-3 h-3 text-primary" />
              </div>
              <span className="text-[13px] text-muted-foreground line-clamp-1">{beneficio}</span>
            </div>
          ))}
          {benefits.length > 4 && (
            <p className="text-[11px] text-primary font-semibold pl-[30px]">
              +{benefits.length - 4} benefícios inclusos
            </p>
          )}
        </div>

        {!isSelected && (
          <div className="mt-4 pt-3 border-t border-border/20">
            <p className="text-[11px] text-center text-muted-foreground/60 font-medium">
              Toque para selecionar
            </p>
          </div>
        )}
        {isSelected && (
          <div className="mt-4 pt-3 border-t border-primary/20">
            <p className="text-[11px] text-center text-primary font-semibold">
              ✓ Plano selecionado
            </p>
          </div>
        )}
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

  // Barber selection
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const { ratings } = useBarberRatings(barbers.map(b => b.id));

  useEffect(() => {
    loadPlans();
    loadBarbers();
    checkActiveSubscription();
  }, []);

  useEffect(() => {
    if (resumePlanId && plans.length > 0 && (step === 0 || step === 1)) {
      const plan = plans.find(p => p.id === resumePlanId);
      if (plan) {
        setSelectedPlan(plan);
        setStep(2); // go to barber selection
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

  const loadBarbers = async () => {
    const { data } = await supabase
      .from('barbeiros')
      .select('id, apelido, foto_url')
      .eq('ativo', true)
      .order('apelido');
    setBarbers(data || []);
  };

  const handleProceedToBarber = () => {
    if (!selectedPlan) return;
    setStep(2);
  };

  const handleProceedToPayment = () => {
    if (!selectedBarber) {
      toast.error("Selecione um barbeiro");
      return;
    }
    setStep(3);
  };

  const handlePayment = async () => {
    if (!selectedPlan || !selectedPaymentMethod || !selectedBarber) return;
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
          body: { planoId: selectedPlan.id, barbeiroId: selectedBarber.id }
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        if (data?.url) {
          // Store barber info for post-payment redirect
          sessionStorage.setItem("subscription_barber_id", selectedBarber.id);
          window.location.href = data.url;
          toast.info("Complete o pagamento para ativar sua assinatura");
        }
      } else {
        const { data, error } = await supabase.functions.invoke('create-subscription-pix', {
          body: { planoId: selectedPlan.id, barbeiroId: selectedBarber.id }
        });
        if (error) throw error;
        if (data?.success) {
          sessionStorage.setItem("subscription_barber_id", selectedBarber.id);
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

  const headerTitle = step === 1 
    ? "Escolha seu plano" 
    : step === 2 
      ? "Escolha seu barbeiro" 
      : "Forma de pagamento";

  const handleBack = () => {
    if (step === 3) {
      setStep(2);
      setSelectedPaymentMethod(null);
    } else if (step === 2) {
      setStep(1);
      setSelectedBarber(null);
    } else {
      navigate("/cliente");
    }
  };

  return (
    <div className="min-h-screen pb-20">
      
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 mb-4 bg-background/80 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button 
            onClick={handleBack}
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

          {/* Step dots */}
          <div className="ml-auto flex items-center gap-1.5">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all",
                  step >= s ? "bg-primary" : "bg-muted-foreground/20"
                )}
              />
            ))}
          </div>
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

          {/* Step 2: Seleção de Barbeiro */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              className="pb-28"
            >
              <div className="mb-5 pt-1">
                <h2 className="text-xl font-semibold text-foreground">
                  Seu Barbeiro
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Escolha o profissional exclusivo do seu plano
                </p>
              </div>

              <div className="space-y-2">
                {barbers.map((barber, index) => (
                  <motion.div
                    key={barber.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                  >
                    <BarberCard
                      barber={barber}
                      isSelected={selectedBarber?.id === barber.id}
                      onSelect={() => setSelectedBarber(barber)}
                      rating={ratings[barber.id]}
                    />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 3: Pagamento */}
          {step === 3 && selectedPlan && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              className="pb-28"
            >
              <div className="mb-6 pt-1">
                <h2 className="text-xl font-semibold text-foreground">
                  Pagamento
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Escolha como deseja pagar
                </p>
              </div>

              {/* Resumo do plano + barbeiro */}
              <div className="bg-card border border-border/40 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-medium text-foreground">
                      {selectedPlan.nome}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Assinatura mensal • Renovação automática
                    </p>
                  </div>
                  <p className="text-base font-bold text-foreground tabular-nums">
                    R$ {selectedPlan.preco_mensal.toFixed(2).replace('.', ',')}
                  </p>
                </div>
                {selectedBarber && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/30">
                    <div className="w-6 h-6 rounded-full overflow-hidden bg-muted/20 flex items-center justify-center flex-shrink-0">
                      {selectedBarber.foto_url ? (
                        <img src={selectedBarber.foto_url} alt={selectedBarber.apelido} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-3.5 h-3.5 text-muted-foreground/40" />
                      )}
                    </div>
                    <p className="text-[12px] text-muted-foreground">
                      Barbeiro: <span className="font-medium text-foreground">{selectedBarber.apelido}</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Métodos de pagamento */}
              <div className="space-y-3 mb-4">
                {/* PIX */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedPaymentMethod("pix")}
                  className={cn(
                    "w-full rounded-xl border p-4 text-left transition-all",
                    selectedPaymentMethod === "pix"
                      ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                      : "border-border/30 bg-card hover:border-border/50"
                  )}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <img src={pixIcon} alt="PIX" className="w-5 h-5 object-contain" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-semibold text-foreground">Pix</p>
                        <span className="text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-px rounded">
                          Recomendado
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Confirmação instantânea • Sem taxa
                      </p>
                    </div>
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all",
                      selectedPaymentMethod === "pix"
                        ? "bg-primary border-primary"
                        : "border-muted-foreground/30"
                    )}>
                      {selectedPaymentMethod === "pix" && <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />}
                    </div>
                  </div>
                </motion.button>

                {/* Cartão */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedPaymentMethod("card")}
                  className={cn(
                    "w-full rounded-xl border p-4 text-left transition-all",
                    selectedPaymentMethod === "card"
                      ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                      : "border-border/30 bg-card hover:border-border/50"
                  )}
                >
                  <div className="flex items-center gap-3.5">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                      selectedPaymentMethod === "card" ? "bg-primary/10" : "bg-muted/30"
                    )}>
                      <CreditCard className={cn(
                        "w-5 h-5 transition-colors",
                        selectedPaymentMethod === "card" ? "text-primary" : "text-muted-foreground/50"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-foreground">Cartão</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Crédito ou débito • Checkout seguro
                      </p>
                    </div>
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all",
                      selectedPaymentMethod === "card"
                        ? "bg-primary border-primary"
                        : "border-muted-foreground/30"
                    )}>
                      {selectedPaymentMethod === "card" && <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />}
                    </div>
                  </div>
                </motion.button>
              </div>

              {/* Selo de segurança */}
              <div className="flex items-center justify-center gap-1.5 mt-6">
                <Shield className="w-3 h-3 text-muted-foreground/40" />
                <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wider font-medium">
                  Pagamento Criptografado
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Bottom Bars */}
      <AnimatePresence>
        {/* Step 1 — Plan selected */}
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
                    onClick={handleProceedToBarber}
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

        {/* Step 2 — Barber selected */}
        {step === 2 && selectedBarber && !hasActiveSubscription && (
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
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-muted/20 flex items-center justify-center flex-shrink-0">
                      {selectedBarber.foto_url ? (
                        <img src={selectedBarber.foto_url} alt={selectedBarber.apelido} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-4 h-4 text-muted-foreground/40" />
                      )}
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground/60">Barbeiro</div>
                      <div className="text-sm font-semibold text-foreground">
                        {selectedBarber.apelido}
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

        {/* Step 3 — Payment method selected */}
        {step === 3 && selectedPaymentMethod && !hasActiveSubscription && (
          <motion.div
            key="bar-step3"
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
