import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Crown,
  Sparkles,
  Star,
  Zap,
  Shield,
  ArrowRight
} from "lucide-react";
import { BackArrow } from "@/components/ui/back-arrow";
import { toast } from "sonner";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Plan {
  id: string;
  nome: string;
  descricao: string;
  preco_mensal: number;
  beneficios_json: any;
  prioridade_agendamento: number;
}

interface SubscribePlanSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
}

type LoadingState = "idle" | "loading" | "error" | "success";

const planIcons = [Crown, Star, Zap, Shield];

/** Compact plan card for the selection list */
function PlanCard({ 
  plan, 
  isPopular,
  isSelected,
  onSelect,
  index
}: { 
  plan: Plan;
  isPopular?: boolean;
  isSelected: boolean;
  onSelect: () => void;
  index: number;
}) {
  const benefits = Array.isArray(plan.beneficios_json) ? plan.beneficios_json : [];
  const PlanIcon = planIcons[index % planIcons.length];

  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      onClick={onSelect}
      className={cn(
        "w-full text-left rounded-2xl border-2 p-5 transition-all duration-200",
        "active:scale-[0.98]",
        isSelected 
          ? "border-primary bg-card shadow-lg shadow-primary/10" 
          : isPopular
            ? "border-primary/30 bg-card shadow-sm"
            : "border-border/40 bg-card"
      )}
    >
      {/* Popular badge */}
      {isPopular && (
        <div className="flex items-center gap-1.5 mb-3">
          <div className="flex items-center gap-1 bg-primary text-primary-foreground px-2.5 py-1 rounded-md">
            <Sparkles className="w-3 h-3" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Mais Popular</span>
          </div>
        </div>
      )}

      {/* Plan name + icon */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-foreground leading-tight">{plan.nome}</h3>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{plan.descricao}</p>
        </div>
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
          isSelected ? "bg-primary/15" : "bg-muted/50"
        )}>
          <PlanIcon className={cn("w-5 h-5", isSelected ? "text-primary" : "text-muted-foreground")} />
        </div>
      </div>

      {/* Price */}
      <div className="flex items-baseline gap-1 mt-4">
        <span className="text-[11px] text-muted-foreground font-medium">R$</span>
        <span className="text-3xl font-extrabold text-foreground tabular-nums tracking-tight">
          {Number(plan.preco_mensal).toFixed(2).replace('.', ',')}
        </span>
        <span className="text-xs text-muted-foreground font-medium">/mês</span>
      </div>

      {/* Benefits — separator + list */}
      {benefits.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border/30 space-y-2">
          {benefits.map((benefit: string, i: number) => (
            <div key={i} className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-[13px] text-foreground/80 font-medium">{benefit}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tap to select hint */}
      <div className="mt-4 pt-3 border-t border-border/20 flex items-center justify-center">
        <span className={cn(
          "text-[11px] font-medium transition-colors",
          isSelected ? "text-primary" : "text-muted-foreground/50"
        )}>
          {isSelected ? "✓ Plano selecionado" : "Toque para selecionar"}
        </span>
      </div>
    </motion.button>
  );
}

/** Full-screen detail slide for a single plan */
function PlanDetailSlide({ 
  plan, 
  index,
  onContinue
}: { 
  plan: Plan;
  index: number;
  onContinue: () => void;
}) {
  const benefits = Array.isArray(plan.beneficios_json) ? plan.beneficios_json : [];
  const PlanIcon = planIcons[index % planIcons.length];
  const isFirst = index === 0;

  return (
    <div className="flex flex-col h-full px-6 py-4">
      {/* Top — Icon + Name + Price */}
      <div className="flex flex-col items-center text-center space-y-4 pt-6 flex-shrink-0">
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
          className="relative"
        >
          <div className={cn(
            "w-20 h-20 rounded-2xl flex items-center justify-center",
            isFirst ? "bg-primary/15" : "bg-muted/60"
          )}>
            <PlanIcon className={cn("w-9 h-9", isFirst ? "text-primary" : "text-muted-foreground")} />
          </div>
          {isFirst && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="absolute -top-2 -right-3 bg-primary text-primary-foreground px-2 py-0.5 rounded-md"
            >
              <div className="flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                <span className="text-[9px] font-bold uppercase tracking-wider">Popular</span>
              </div>
            </motion.div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="space-y-1.5"
        >
          <h2 className="text-2xl font-bold text-foreground tracking-tight">{plan.nome}</h2>
          <p className="text-xs text-muted-foreground max-w-[280px] leading-relaxed">{plan.descricao}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-baseline gap-1"
        >
          <span className="text-[11px] text-muted-foreground font-medium">R$</span>
          <span className="text-5xl font-extrabold text-foreground tabular-nums tracking-tighter">
            {Number(plan.preco_mensal).toFixed(2).replace('.', ',')}
          </span>
          <span className="text-sm text-muted-foreground font-medium">/mês</span>
        </motion.div>
      </div>

      {/* Middle — Benefits list */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-6"
      >
        <div className="rounded-2xl border border-border/40 bg-card p-5 space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
            TUDO QUE VOCÊ RECEBE
          </p>
          <div className="space-y-3">
            {benefits.map((benefit: string, i: number) => (
              <motion.div 
                key={i} 
                className="flex items-start gap-3"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.05 }}
              >
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="text-[14px] text-foreground/85 leading-snug font-medium">{benefit}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Bottom — Continue */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex-shrink-0 pb-4 space-y-2"
      >
        <Button
          onClick={onContinue}
          className="w-full h-12 text-sm font-bold rounded-xl bg-foreground hover:bg-foreground/90 text-background"
        >
          <span>Ver todos os planos</span>
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
        <p className="text-[10px] text-center text-muted-foreground/50">
          Cancele quando quiser • Sem fidelidade
        </p>
      </motion.div>
    </div>
  );
}

export function SubscribePlanSheet({ open, onOpenChange, userId }: SubscribePlanSheetProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>("idle");
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  
  // Two-phase flow: "showcase" (swipeable detail slides) → "select" (all plans list)
  const [phase, setPhase] = useState<"showcase" | "select">("showcase");
  const [showcaseIndex, setShowcaseIndex] = useState(0);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPhase("showcase");
      setShowcaseIndex(0);
      setSelectedPlanId(null);
      loadPlans();
    }
  }, [open]);


  const loadPlans = async () => {
    setLoadingState("loading");
    setErrorMessage("");
    try {
      const { data, error } = await supabase
        .from("planos")
        .select("*")
        .eq("ativo", true)
        .order("prioridade_agendamento", { ascending: false });

      if (error) {
        setLoadingState("error");
        setErrorMessage("Não foi possível carregar os planos disponíveis.");
        toast.error("Erro ao carregar planos");
      } else {
        const normalizedData = (data || []).map(plan => ({
          ...plan,
          beneficios_json: Array.isArray(plan.beneficios_json) 
            ? plan.beneficios_json 
            : typeof plan.beneficios_json === 'string'
            ? JSON.parse(plan.beneficios_json)
            : []
        }));
        const filteredPlans = normalizedData.filter(plan => {
          const nomeLower = plan.nome.toLowerCase();
          return (nomeLower === 'plano corte' || 
                  nomeLower === 'plano corte + barba' ||
                  nomeLower.includes('corte') && !nomeLower.includes('deluxe') &&
                  !nomeLower.includes('supreme') && !nomeLower.includes('gentleman'));
        });
        setPlans(filteredPlans);
        setLoadingState("success");
        if (filteredPlans.length === 0) setErrorMessage("Nenhum plano disponível no momento.");
      }
    } catch (err) {
      setLoadingState("error");
      setErrorMessage("Erro inesperado ao carregar planos. Verifique sua conexão.");
    }
  };

  const handleSubscribe = async (planId: string) => {
    if (!userId) { toast.error("Usuário não autenticado"); return; }
    setSubscribing(planId);
    try {
      const { data: existing, error: checkError } = await supabase
        .from("assinaturas").select("id").eq("user_id", userId).eq("status", "active").maybeSingle();
      if (checkError) { toast.error("Erro ao verificar assinaturas existentes"); setSubscribing(null); return; }
      if (existing) { toast.error("Você já possui um plano ativo"); setSubscribing(null); return; }

      // Redireciona para o fluxo completo de assinatura (com seleção obrigatória de barbeiro + pagamento)
      onOpenChange(false);
      window.location.href = `/cliente/assinar?planoId=${planId}`;
    } catch (err) {
      toast.error("Erro inesperado ao iniciar assinatura");
    } finally {
      setSubscribing(null);
    }
  };

  const goToSelect = useCallback(() => {
    setPhase("select");
    if (plans.length > 0) setSelectedPlanId(plans[0].id);
  }, [plans]);

  const handleShowcaseNext = useCallback(() => {
    if (showcaseIndex < plans.length - 1) {
      setShowcaseIndex(prev => prev + 1);
    } else {
      goToSelect();
    }
  }, [showcaseIndex, plans.length, goToSelect]);

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: "100%" }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="fixed inset-0 z-50 bg-background flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2 flex-shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (phase === "select") { setPhase("showcase"); setShowcaseIndex(0); }
                  else onOpenChange(false);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-card border border-border/40 hover:bg-muted transition-colors"
              >
                <BackArrow size={18} className="text-foreground" />
              </button>
              <h1 className="text-sm font-semibold text-foreground tracking-tight">
                {phase === "showcase" ? "Conheça nossos planos" : "Escolha seu plano"}
              </h1>
            </div>

            {/* Dots for showcase phase */}
            {phase === "showcase" && loadingState === "success" && plans.length > 1 && (
              <div className="flex items-center gap-1.5 pr-1">
                {plans.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-full transition-all duration-300",
                      i === showcaseIndex
                        ? "w-5 h-1.5 bg-primary"
                        : i < showcaseIndex
                          ? "w-1.5 h-1.5 bg-primary/40"
                          : "w-1.5 h-1.5 bg-muted-foreground/25"
                    )}
                  />
                ))}
                {/* Extra dot for the selection page */}
                <div className={cn(
                  "rounded-full transition-all duration-300 w-1.5 h-1.5 bg-muted-foreground/25"
                )} />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 relative">
            {/* Loading */}
            {loadingState === "loading" && (
              <div className="flex flex-col items-center justify-center h-full px-6 space-y-6">
                <div className="w-20 h-20 rounded-2xl bg-muted animate-pulse" />
                <div className="space-y-2 w-full max-w-[240px]">
                  <Skeleton className="h-5 w-2/3 mx-auto bg-muted" />
                  <Skeleton className="h-3 w-full bg-muted" />
                  <Skeleton className="h-8 w-1/2 mx-auto bg-muted mt-4" />
                </div>
              </div>
            )}

            {/* Error */}
            {loadingState === "error" && (
              <div className="flex flex-col items-center justify-center h-full px-6 space-y-5">
                <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-destructive" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium text-foreground">Erro ao carregar planos</p>
                  <p className="text-xs text-muted-foreground max-w-[260px]">{errorMessage}</p>
                </div>
                <Button onClick={loadPlans} size="sm" className="h-9 px-5">
                  <Loader2 className="w-3.5 h-3.5 mr-1.5" />
                  Tentar Novamente
                </Button>
              </div>
            )}

            {/* Empty */}
            {loadingState === "success" && plans.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full px-6 space-y-5">
                <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center">
                  <Crown className="w-6 h-6 text-muted-foreground" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Nenhum plano disponível</p>
                  <p className="text-xs text-muted-foreground">Tente novamente mais tarde.</p>
                </div>
              </div>
            )}

            {/* ═══ PHASE 1: Showcase — one plan per screen ═══ */}
            {loadingState === "success" && plans.length > 0 && phase === "showcase" && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={showcaseIndex}
                  initial={{ opacity: 0, x: 60 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -60 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="h-full"
                >
                  <PlanDetailSlide
                    plan={plans[showcaseIndex]}
                    index={showcaseIndex}
                    onContinue={handleShowcaseNext}
                  />
                </motion.div>
              </AnimatePresence>
            )}

            {/* ═══ PHASE 2: Selection — all plans as cards ═══ */}
            {loadingState === "success" && plans.length > 0 && phase === "select" && (
              <motion.div
                initial={{ opacity: 0, x: 60 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="h-full flex flex-col"
              >
                {/* Scrollable plan cards */}
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-36">
                  {/* Intro text */}
                  <motion.div 
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-4 space-y-1"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                      SELECIONE O IDEAL PARA VOCÊ
                    </p>
                  </motion.div>

                  <div className="space-y-3.5">
                    {plans.map((plan, index) => (
                      <PlanCard
                        key={plan.id}
                        plan={plan}
                        index={index}
                        isPopular={index === 0}
                        isSelected={selectedPlanId === plan.id}
                        onSelect={() => setSelectedPlanId(plan.id)}
                      />
                    ))}
                  </div>
                </div>

                {/* Fixed bottom CTA */}
                <div className="absolute bottom-0 left-0 right-0 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-4 bg-gradient-to-t from-background via-background to-transparent">
                  <Button
                    onClick={() => selectedPlanId && handleSubscribe(selectedPlanId)}
                    disabled={!selectedPlanId || !!subscribing}
                    className={cn(
                      "w-full h-12 text-sm font-bold rounded-xl transition-all",
                      selectedPlanId
                        ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {subscribing ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processando...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Crown className="w-4 h-4" />
                        Assinar Plano
                      </div>
                    )}
                  </Button>
                  <p className="text-[10px] text-center text-muted-foreground/50 mt-2">
                    Cancele quando quiser • Sem fidelidade
                  </p>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
