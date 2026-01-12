import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  CheckCircle2, 
  Sparkles, 
  AlertCircle, 
  Loader2,
  ChevronLeft,
  Crown,
  TrendingDown
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

// Componente de Card de Plano Premium
function PlanCard({ 
  plan, 
  isPopular,
  onSubscribe,
  isSubscribing 
}: { 
  plan: Plan;
  isPopular?: boolean;
  onSubscribe: () => void;
  isSubscribing: boolean;
}) {
  const benefits = Array.isArray(plan.beneficios_json) ? plan.beneficios_json : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative rounded-2xl p-6 border transition-all",
        isPopular 
          ? "bg-gradient-to-br from-red-500/10 to-orange-500/10 border-red-500/30 shadow-xl shadow-red-500/10" 
          : "bg-zinc-900/50 border-zinc-800"
      )}
    >
      {/* Badge "Mais Popular" */}
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg flex items-center gap-1">
            <Crown className="w-3 h-3" />
            MAIS POPULAR
          </div>
        </div>
      )}

      {/* Header do Card */}
      <div className="mb-4">
        <h3 className="text-xl font-bold text-white mb-2">
          {plan.nome}
        </h3>
        <p className="text-sm text-zinc-400">
          {plan.descricao}
        </p>
      </div>

      {/* Preço */}
      <div className="mb-6">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-red-500">
            R$ {Number(plan.preco_mensal).toFixed(2).replace('.', ',')}
          </span>
          <span className="text-zinc-500">/mês</span>
        </div>
      </div>

      {/* Benefícios */}
      <div className="space-y-3 mb-6">
        <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
          Benefícios inclusos
        </h4>
        
        {benefits.map((benefit: string, index: number) => (
          <div key={index} className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-zinc-300">{benefit}</span>
          </div>
        ))}
      </div>

      {/* Botão CTA */}
      <Button
        onClick={onSubscribe}
        disabled={isSubscribing}
        className={cn(
          "w-full h-12 font-bold transition-all",
          isPopular
            ? "bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg hover:shadow-xl hover:shadow-red-500/20 hover:scale-[1.02]"
            : "bg-zinc-800 text-white hover:bg-zinc-700"
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
        {
          event: '*',
          schema: 'public',
          table: 'planos'
        },
        (payload) => {
          console.log('Plan change detected:', payload);
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
        toast.success("✅ Assinatura efetuada com sucesso!");
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

  const renderLoadingState = () => (
    <div className="space-y-4 pb-6">
      {[1, 2].map((i) => (
        <div key={i} className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800">
          <Skeleton className="h-6 w-3/4 mb-3 bg-zinc-800" />
          <Skeleton className="h-4 w-full mb-2 bg-zinc-800" />
          <Skeleton className="h-10 w-32 mb-4 bg-zinc-800" />
          <Skeleton className="h-20 w-full mb-3 bg-zinc-800" />
          <Skeleton className="h-12 w-full bg-zinc-800" />
        </div>
      ))}
    </div>
  );

  const renderErrorState = () => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-12 space-y-6"
    >
      <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
        <AlertCircle className="w-10 h-10 text-red-500" />
      </div>
      <div className="space-y-2">
        <p className="text-lg font-semibold text-white">Erro ao carregar planos</p>
        <p className="text-sm text-zinc-400 max-w-xs mx-auto">
          {errorMessage}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Button
          onClick={loadPlans}
          className="h-12 px-6 bg-red-500 hover:bg-red-600"
        >
          <Loader2 className="w-4 h-4 mr-2" />
          Tentar Novamente
        </Button>
        <Button
          onClick={() => onOpenChange(false)}
          variant="ghost"
          className="text-zinc-400"
        >
          Voltar
        </Button>
      </div>
    </motion.div>
  );

  const renderEmptyState = () => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-12 space-y-6"
    >
      <div className="w-20 h-20 bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto">
        <Sparkles className="w-10 h-10 text-zinc-600" />
      </div>
      <div className="space-y-2">
        <p className="text-lg font-semibold text-zinc-400">Nenhum plano disponível</p>
        <p className="text-sm text-zinc-500">
          Não há planos disponíveis no momento. Tente novamente mais tarde.
        </p>
      </div>
      <Button
        onClick={() => onOpenChange(false)}
        variant="ghost"
        className="text-zinc-400"
      >
        Voltar
      </Button>
    </motion.div>
  );

  const renderPlansList = () => (
    <div className="space-y-4 pb-20">
      {/* Destaque - Economia */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/20 rounded-xl p-4 mb-6"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
            <TrendingDown className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">Economize todo mês</h3>
            <p className="text-xs text-zinc-400">Agendamento prioritário garantido</p>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {plans.map((plan, index) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <PlanCard 
              plan={plan}
              isPopular={index === 0}
              onSubscribe={() => handleSubscribe(plan.id)}
              isSubscribing={subscribing === plan.id}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="h-[90vh] rounded-t-3xl flex flex-col overflow-hidden bg-zinc-950 border-zinc-800 p-0"
      >
        {/* Header */}
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 px-4 py-4 z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-red-500" />
              <h2 className="text-lg font-bold">Escolha seu Plano</h2>
            </div>
          </div>
        </div>

        {/* Container com scroll */}
        <div className="flex-1 overflow-y-auto p-4">
          {loadingState === "loading" && renderLoadingState()}
          {loadingState === "error" && renderErrorState()}
          {loadingState === "success" && plans.length === 0 && renderEmptyState()}
          {loadingState === "success" && plans.length > 0 && renderPlansList()}
        </div>
      </SheetContent>
    </Sheet>
  );
}
