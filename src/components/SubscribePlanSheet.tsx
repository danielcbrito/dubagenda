import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  ArrowLeft,
  Crown
} from "lucide-react";
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

/** Card individual de plano */
function PlanCard({ 
  plan, 
  isHighlighted,
  onSubscribe,
  isSubscribing 
}: { 
  plan: Plan;
  isHighlighted?: boolean;
  onSubscribe: () => void;
  isSubscribing: boolean;
}) {
  const benefits = Array.isArray(plan.beneficios_json) ? plan.beneficios_json : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative rounded-2xl border transition-all overflow-hidden",
        isHighlighted 
          ? "border-primary/40 bg-card shadow-lg shadow-primary/5" 
          : "border-border/40 bg-card"
      )}
    >
      {/* Accent top line for highlighted */}
      {isHighlighted && (
        <div className="h-0.5 bg-gradient-to-r from-primary via-primary/80 to-primary/40" />
      )}

      <div className="p-6 space-y-5">
        {/* Name & Description */}
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-foreground">{plan.nome}</h3>
          <p className="text-sm text-muted-foreground">{plan.descricao}</p>
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-primary">
            R$ {Number(plan.preco_mensal).toFixed(2).replace('.', ',')}
          </span>
          <span className="text-sm text-muted-foreground">/mês</span>
        </div>

        {/* Benefits */}
        {benefits.length > 0 && (
          <div className="space-y-2.5 pt-2 border-t border-border/30">
            {benefits.map((benefit: string, index: number) => (
              <div key={index} className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-sm text-muted-foreground">{benefit}</span>
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <Button
          onClick={onSubscribe}
          disabled={isSubscribing}
          className={cn(
            "w-full h-12 font-semibold transition-all",
            isHighlighted
              ? "bg-primary hover:bg-primary/90 text-primary-foreground"
              : "bg-secondary hover:bg-secondary/80 text-secondary-foreground"
          )}
        >
          {isSubscribing ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Processando...
            </div>
          ) : (
            "Assinar Agora"
          )}
        </Button>
      </div>
    </motion.div>
  );
}

export function SubscribePlanSheet({ open, onOpenChange, userId }: SubscribePlanSheetProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>("idle");
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    if (open) {
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
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border/40">
            <button
              onClick={() => onOpenChange(false)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-card hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <h1 className="text-lg font-bold text-foreground">Escolha seu Plano</h1>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 py-6">
            {/* Loading */}
            {loadingState === "loading" && (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="rounded-2xl p-6 border border-border/40 bg-card">
                    <Skeleton className="h-5 w-3/4 mb-3 bg-muted" />
                    <Skeleton className="h-4 w-full mb-2 bg-muted" />
                    <Skeleton className="h-8 w-32 mb-4 bg-muted" />
                    <Skeleton className="h-16 w-full mb-3 bg-muted" />
                    <Skeleton className="h-12 w-full bg-muted" />
                  </div>
                ))}
              </div>
            )}

            {/* Error */}
            {loadingState === "error" && (
              <div className="flex flex-col items-center justify-center pt-20 space-y-6">
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-destructive" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium text-foreground">Erro ao carregar planos</p>
                  <p className="text-xs text-muted-foreground max-w-xs">{errorMessage}</p>
                </div>
                <Button onClick={loadPlans} className="h-11 px-6 bg-primary hover:bg-primary/90">
                  <Loader2 className="w-4 h-4 mr-2" />
                  Tentar Novamente
                </Button>
              </div>
            )}

            {/* Empty */}
            {loadingState === "success" && plans.length === 0 && (
              <div className="flex flex-col items-center justify-center pt-20 space-y-6">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
                  <Crown className="w-8 h-8 text-muted-foreground" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Nenhum plano disponível</p>
                  <p className="text-xs text-muted-foreground">
                    Tente novamente mais tarde.
                  </p>
                </div>
              </div>
            )}

            {/* Plans List */}
            {loadingState === "success" && plans.length > 0 && (
              <div className="space-y-4 pb-6">
                {plans.map((plan, index) => (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.08 }}
                  >
                    <PlanCard
                      plan={plan}
                      isHighlighted={index === 0}
                      onSubscribe={() => handleSubscribe(plan.id)}
                      isSubscribing={subscribing === plan.id}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
