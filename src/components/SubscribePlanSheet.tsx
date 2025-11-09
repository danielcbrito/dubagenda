import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Gift, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

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

export function SubscribePlanSheet({ open, onOpenChange, userId }: SubscribePlanSheetProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadPlans();
    }
  }, [open]);

  const loadPlans = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("planos")
      .select("*")
      .eq("ativo", true)
      .order("prioridade_agendamento", { ascending: true });

    if (error) {
      console.error("Error loading plans:", error);
      toast.error("Erro ao carregar planos");
    } else {
      setPlans(data || []);
    }
    setLoading(false);
  };

  const handleSubscribe = async (planId: string) => {
    if (!userId) {
      toast.error("Usuário não identificado");
      return;
    }

    setSubscribing(planId);

    // Check if user already has an active subscription
    const { data: existing } = await supabase
      .from("assinaturas")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (existing) {
      toast.error("Você já possui um plano ativo");
      setSubscribing(null);
      return;
    }

    // Create subscription
    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

    const { error } = await supabase
      .from("assinaturas")
      .insert([{
        user_id: userId,
        plano_id: planId,
        status: "active",
        next_billing_date: nextBillingDate.toISOString().split('T')[0]
      }]);

    if (error) {
      console.error("Error creating subscription:", error);
      toast.error("Erro ao assinar plano");
    } else {
      toast.success("Plano assinado com sucesso!");
      onOpenChange(false);
    }

    setSubscribing(null);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] rounded-t-[10px]">
        <SheetHeader>
          <SheetTitle className="text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-gold" />
            Escolha seu Plano
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(90vh-80px)] mt-6">
          <div className="space-y-4 pb-6 pr-4">
            {loading ? (
              <div className="text-center text-sm text-muted-foreground py-8">
                Carregando planos...
              </div>
            ) : (
              plans.map((plan) => (
                <Card
                  key={plan.id}
                  className="p-5 border-0 shadow-elegant hover:shadow-glow transition-all duration-300"
                >
                  <div
                    className="space-y-4"
                    style={{
                      background: "linear-gradient(135deg, hsl(var(--background)) 0%, hsl(var(--primary) / 0.12) 100%)"
                    }}
                  >
                    <div className="space-y-2">
                      <h3 className="text-base font-semibold flex items-center gap-2">
                        {plan.nome}
                        {plan.prioridade_agendamento >= 4 && (
                          <Sparkles className="w-4 h-4 text-gold" />
                        )}
                      </h3>
                      <p className="text-xs text-muted-foreground">{plan.descricao}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Gift className="w-5 h-5 text-gold" />
                      <div>
                        <span className="text-2xl font-bold text-gold">
                          R$ {Number(plan.preco_mensal).toFixed(2)}
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">/mês</span>
                      </div>
                    </div>

                    <div className="space-y-2 pt-3 border-t border-border/20">
                      <p className="text-xs font-medium">Benefícios:</p>
                      {plan.beneficios_json?.map((benefit, index) => (
                        <div key={index} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-gold flex-shrink-0" />
                          <span>{benefit}</span>
                        </div>
                      ))}
                    </div>

                    <Button
                      onClick={() => handleSubscribe(plan.id)}
                      disabled={subscribing !== null}
                      className="w-full h-11 bg-primary hover:bg-primary/90 text-sm font-semibold transition-all duration-300 hover:scale-[1.02] mt-4"
                    >
                      {subscribing === plan.id ? "Processando..." : "Assinar Agora"}
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
