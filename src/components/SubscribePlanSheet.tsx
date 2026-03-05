import { useEffect, useState, useRef, useCallback } from "react";
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
  ChevronLeft,
  ChevronRight
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

/** Full-screen slide for a single plan */
function PlanSlide({ 
  plan, 
  isHighlighted,
  onSubscribe,
  isSubscribing,
  index
}: { 
  plan: Plan;
  isHighlighted?: boolean;
  onSubscribe: () => void;
  isSubscribing: boolean;
  index: number;
}) {
  const benefits = Array.isArray(plan.beneficios_json) ? plan.beneficios_json : [];
  
  const planIcons = [Crown, Star, Zap, Shield];
  const PlanIcon = planIcons[index % planIcons.length];

  return (
    <div className="flex flex-col items-center justify-between h-full px-6 py-6">
      {/* Top section — Icon + Name */}
      <div className="flex flex-col items-center text-center space-y-4 pt-4">
        {/* Plan icon with glow */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
          className="relative"
        >
          <div className={cn(
            "w-20 h-20 rounded-2xl flex items-center justify-center",
            isHighlighted 
              ? "bg-primary/15" 
              : "bg-muted/60"
          )}>
            <PlanIcon className={cn(
              "w-9 h-9",
              isHighlighted ? "text-primary" : "text-muted-foreground"
            )} />
          </div>
          {isHighlighted && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="absolute -top-2 -right-2 bg-primary text-primary-foreground px-2 py-0.5 rounded-md"
            >
              <div className="flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                <span className="text-[9px] font-bold uppercase tracking-wider">Popular</span>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Plan name */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-1.5"
        >
          <h2 className="text-xl font-bold text-foreground tracking-tight">{plan.nome}</h2>
          <p className="text-xs text-muted-foreground max-w-[260px] leading-relaxed">{plan.descricao}</p>
        </motion.div>

        {/* Price — hero element */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25 }}
          className="flex items-baseline gap-1 pt-2"
        >
          <span className="text-[10px] text-muted-foreground font-medium mt-1">R$</span>
          <span className="text-4xl font-extrabold text-foreground tabular-nums tracking-tight">
            {Number(plan.preco_mensal).toFixed(2).replace('.', ',')}
          </span>
          <span className="text-xs text-muted-foreground font-medium">/mês</span>
        </motion.div>
      </div>

      {/* Middle section — Benefits */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="w-full flex-1 min-h-0 overflow-y-auto overscroll-contain py-5"
      >
        <div className="rounded-xl border border-border/40 bg-card p-4 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
            O QUE ESTÁ INCLUSO
          </p>
          <div className="space-y-2.5">
            {benefits.map((benefit: string, i: number) => (
              <motion.div 
                key={i} 
                className="flex items-start gap-3"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 + i * 0.04 }}
              >
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="w-3 h-3 text-primary" />
                </div>
                <span className="text-[13px] text-foreground/80 leading-snug">{benefit}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Bottom section — CTA */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="w-full space-y-2.5 pb-2"
      >
        <Button
          onClick={onSubscribe}
          disabled={isSubscribing}
          className={cn(
            "w-full h-12 text-sm font-bold transition-all rounded-xl",
            isHighlighted
              ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
              : "bg-foreground hover:bg-foreground/90 text-background"
          )}
        >
          {isSubscribing ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Processando...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4" />
              Assinar Agora
            </div>
          )}
        </Button>
        <p className="text-[10px] text-center text-muted-foreground/60">
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setCurrentIndex(0);
      loadPlans();
    }
  }, [open]);

  useEffect(() => {
    const channel = supabase
      .channel('plans-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'planos' },
        (payload) => {
          if (open) {
            loadPlans();
            if (payload.eventType === 'INSERT') {
              toast.success("Novo plano disponível!");
            } else if (payload.eventType === 'UPDATE') {
              const newData = payload.new as any;
              if (newData.ativo === false) {
                toast.info("Um plano foi desativado");
              } else if (newData.ativo === true && (payload.old as any).ativo === false) {
                toast.success("Novo plano ativado!");
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
        
        if (filteredPlans.length === 0) {
          setErrorMessage("Nenhum plano disponível no momento.");
        }
      }
    } catch (err) {
      setLoadingState("error");
      setErrorMessage("Erro inesperado ao carregar planos. Verifique sua conexão.");
    }
  };

  const handleSubscribe = async (planId: string) => {
    if (!userId) {
      toast.error("Usuário não autenticado");
      return;
    }

    setSubscribing(planId);

    try {
      const { data: existingSubscription, error: checkError } = await supabase
        .from("assinaturas")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (checkError) {
        toast.error("Erro ao verificar assinaturas existentes");
        setSubscribing(null);
        return;
      }

      if (existingSubscription) {
        toast.error("Você já possui um plano ativo");
        setSubscribing(null);
        return;
      }

      const nextBillingDate = new Date();
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

      const { error: insertError } = await supabase
        .from("assinaturas")
        .insert([{
          user_id: userId,
          plano_id: planId,
          status: "active",
          next_billing_date: format(nextBillingDate, 'yyyy-MM-dd')
        }]);

      if (insertError) {
        toast.error("Erro ao criar assinatura. Tente novamente.");
      } else {
        toast.success("Assinatura efetuada com sucesso!");
        setTimeout(() => {
          onOpenChange(false);
        }, 1000);
      }
    } catch (err) {
      toast.error("Erro inesperado ao criar assinatura");
    } finally {
      setSubscribing(null);
    }
  };

  const scrollToIndex = useCallback((index: number) => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const slideWidth = container.offsetWidth;
    container.scrollTo({ left: index * slideWidth, behavior: "smooth" });
    setCurrentIndex(index);
  }, []);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const slideWidth = container.offsetWidth;
    const newIndex = Math.round(container.scrollLeft / slideWidth);
    setCurrentIndex(newIndex);
  }, []);

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
                onClick={() => onOpenChange(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-card border border-border/40 hover:bg-muted transition-colors"
              >
                <BackArrow size={18} className="text-foreground" />
              </button>
              <h1 className="text-sm font-semibold text-foreground tracking-tight">Escolha seu Plano</h1>
            </div>

            {/* Pagination dots */}
            {loadingState === "success" && plans.length > 1 && (
              <div className="flex items-center gap-1.5 pr-1">
                {plans.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => scrollToIndex(i)}
                    className={cn(
                      "rounded-full transition-all duration-300",
                      i === currentIndex
                        ? "w-5 h-1.5 bg-primary"
                        : "w-1.5 h-1.5 bg-muted-foreground/25"
                    )}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Content area */}
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
                <div className="space-y-2 w-full max-w-[300px] mt-6">
                  {[1, 2, 3, 4].map(i => (
                    <Skeleton key={i} className="h-6 w-full bg-muted" />
                  ))}
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

            {/* Swipeable Plans Carousel */}
            {loadingState === "success" && plans.length > 0 && (
              <>
                <div
                  ref={scrollRef}
                  onScroll={handleScroll}
                  className="h-full flex overflow-x-auto overscroll-x-contain snap-x snap-mandatory scrollbar-hide"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
                >
                  {plans.map((plan, index) => (
                    <div
                      key={plan.id}
                      className="w-full h-full flex-shrink-0 snap-center"
                    >
                      <PlanSlide
                        plan={plan}
                        index={index}
                        isHighlighted={index === 0}
                        onSubscribe={() => handleSubscribe(plan.id)}
                        isSubscribing={subscribing === plan.id}
                      />
                    </div>
                  ))}
                </div>

                {/* Swipe hint for first load */}
                {plans.length > 1 && currentIndex === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: 1.5 }}
                    className="absolute bottom-32 left-0 right-0 flex justify-center pointer-events-none"
                  >
                    <motion.div
                      animate={{ x: [0, 8, 0] }}
                      transition={{ repeat: 3, duration: 0.8, ease: "easeInOut" }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-card/80 backdrop-blur-sm border border-border/30"
                    >
                      <span className="text-[10px] text-muted-foreground font-medium">Deslize para ver mais</span>
                      <ChevronRight className="w-3 h-3 text-muted-foreground" />
                    </motion.div>
                  </motion.div>
                )}
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
