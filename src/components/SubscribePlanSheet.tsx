import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Sparkles, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

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
    // Set up realtime listener for plans
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
              } else if (newData.ativo === true && payload.old.ativo === false) {
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
        console.error("Error loading plans:", error);
        setLoadingState("error");
        setErrorMessage("Não foi possível carregar os planos disponíveis.");
        toast.error("Erro ao carregar planos");
      } else {
        // Normalize beneficios_json to always be an array
        const normalizedData = (data || []).map(plan => ({
          ...plan,
          beneficios_json: Array.isArray(plan.beneficios_json) 
            ? plan.beneficios_json 
            : typeof plan.beneficios_json === 'string'
            ? JSON.parse(plan.beneficios_json)
            : []
        }));
        
        // Filter to show only "Plano Corte" and "Plano Corte + Barba"
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
      console.error("Unexpected error loading plans:", err);
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
      // Check for existing active subscription
      const { data: existingSubscription, error: checkError } = await supabase
        .from("assinaturas")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (checkError) {
        console.error("Error checking subscription:", checkError);
        toast.error("Erro ao verificar assinaturas existentes");
        setSubscribing(null);
        return;
      }

      if (existingSubscription) {
        toast.error("Você já possui um plano ativo");
        setSubscribing(null);
        return;
      }

      // Create new subscription
      const nextBillingDate = new Date();
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

      const { error: insertError } = await supabase
        .from("assinaturas")
        .insert([{
          user_id: userId,
          plano_id: planId,
          status: "active",
          next_billing_date: nextBillingDate.toISOString().split('T')[0]
        }]);

      if (insertError) {
        console.error("Error creating subscription:", insertError);
        toast.error("Erro ao criar assinatura. Tente novamente.");
      } else {
        toast.success("✅ Assinatura efetuada com sucesso!");
        setTimeout(() => {
          onOpenChange(false);
        }, 1000);
      }
    } catch (err) {
      console.error("Unexpected error during subscription:", err);
      toast.error("Erro inesperado ao criar assinatura");
    } finally {
      setSubscribing(null);
    }
  };

  const renderLoadingState = () => (
    <div className="space-y-4 pb-6 px-1">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="p-5 border-0">
          <Skeleton className="h-6 w-3/4 mb-3" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-2/3 mb-4" />
          <Skeleton className="h-24 w-full mb-3" />
          <Skeleton className="h-11 w-full" />
        </Card>
      ))}
    </div>
  );

  const renderErrorState = () => (
    <div className="text-center py-12 space-y-6">
      <AlertCircle className="w-16 h-16 mx-auto text-destructive opacity-70" />
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Erro ao carregar planos</p>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
          {errorMessage}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Button
          onClick={loadPlans}
          variant="default"
          className="h-11 px-6"
        >
          <Loader2 className="w-4 h-4 mr-2" />
          Tentar Novamente
        </Button>
        <Button
          onClick={() => onOpenChange(false)}
          variant="ghost"
          size="sm"
        >
          Voltar
        </Button>
      </div>
    </div>
  );

  const renderEmptyState = () => (
    <div className="text-center py-12 space-y-6">
      <Sparkles className="w-16 h-16 mx-auto text-muted-foreground opacity-50" />
      <div className="space-y-2">
        <p className="text-sm font-medium">Nenhum plano disponível</p>
        <p className="text-xs text-muted-foreground">
          Não há planos disponíveis no momento. Tente novamente mais tarde.
        </p>
      </div>
      <Button
        onClick={() => onOpenChange(false)}
        variant="ghost"
      >
        Voltar
      </Button>
    </div>
  );

  const renderPlansList = () => (
    <div className="space-y-4 pb-6 px-1">
      {plans.map((plan) => (
        <Card 
          key={plan.id} 
          className="p-5 border-0 shadow-elegant hover:shadow-glow transition-all duration-300"
        >
          <div 
            className="space-y-4 p-4 rounded-lg"
            style={{
              background: "linear-gradient(135deg, hsl(var(--background)) 0%, hsl(var(--primary) / 0.1) 100%)"
            }}
          >
            <div>
              <h3 className="text-base font-semibold">{plan.nome}</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {plan.descricao}
              </p>
            </div>

            <div className="text-2xl font-bold text-gold">
              R$ {Number(plan.preco_mensal).toFixed(2)}
              <span className="text-sm font-normal text-muted-foreground">/mês</span>
            </div>

            <div className="space-y-2 pt-2 border-t border-border/20">
              <p className="text-xs font-medium">Benefícios inclusos:</p>
              {plan.beneficios_json?.map((benefit: string, index: number) => (
                <div key={index} className="flex items-start gap-2 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-gold flex-shrink-0" />
                  <span className="text-muted-foreground">{benefit}</span>
                </div>
              ))}
            </div>

            <Button
              onClick={() => handleSubscribe(plan.id)}
              disabled={subscribing !== null}
              className="w-full h-11 bg-primary hover:bg-primary/90 transition-all duration-300 disabled:opacity-50"
            >
              {subscribing === plan.id ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                "Assinar Agora"
              )}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] rounded-t-[10px]">
        <SheetHeader>
          <SheetTitle className="text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-gold" />
            Escolha seu Plano
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(90vh-60px)] mt-4">
          {loadingState === "loading" && renderLoadingState()}
          {loadingState === "error" && renderErrorState()}
          {loadingState === "success" && plans.length === 0 && renderEmptyState()}
          {loadingState === "success" && plans.length > 0 && renderPlansList()}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
