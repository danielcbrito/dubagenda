import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gift, Calendar, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Subscription {
  id: string;
  status: string;
  next_billing_date: string | null;
  payment_method: string | null;
  plano: {
    nome: string;
    descricao: string;
    preco_mensal: number;
    beneficios_json: any;
  };
}

interface MyPlansSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  onSubscribe: () => void;
}

export function MyPlansSheet({ open, onOpenChange, userId, onSubscribe }: MyPlansSheetProps) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && userId) {
      loadSubscription();
    }
  }, [open, userId]);

  const loadSubscription = async () => {
    if (!userId) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("assinaturas")
      .select(`
        id,
        status,
        next_billing_date,
        payment_method,
        plano:planos(
          nome,
          descricao,
          preco_mensal,
          beneficios_json
        )
      `)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (error) {
      console.error("Error loading subscription:", error);
      toast.error("Erro ao carregar plano");
    } else {
      setSubscription(data);
    }
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
      active: { label: "Ativo", variant: "default" },
      expired: { label: "Vencido", variant: "destructive" },
      canceled: { label: "Cancelado", variant: "secondary" },
    };
    return statusMap[status] || { label: status, variant: "secondary" };
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-[10px]">
        <SheetHeader>
          <SheetTitle className="text-lg">Meus Planos</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4 overflow-y-auto h-[calc(85vh-80px)] pb-6">
          {loading ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              Carregando...
            </div>
          ) : subscription ? (
            <Card className="p-5 border-0 shadow-elegant">
              <div 
                className="space-y-4"
                style={{
                  background: "linear-gradient(135deg, hsl(var(--background)) 0%, hsl(var(--primary) / 0.15) 100%)"
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-base font-semibold">{subscription.plano.nome}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {subscription.plano.descricao}
                    </p>
                  </div>
                  <Badge variant={getStatusBadge(subscription.status).variant}>
                    {getStatusBadge(subscription.status).label}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Gift className="w-4 h-4 text-gold" />
                  <span className="font-semibold text-gold">
                    R$ {Number(subscription.plano.preco_mensal).toFixed(2)}/mês
                  </span>
                </div>

                {subscription.next_billing_date && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      Próxima cobrança: {format(new Date(subscription.next_billing_date), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                )}

                <div className="space-y-2 pt-3 border-t border-border/20">
                  <p className="text-xs font-medium">Benefícios inclusos:</p>
                  {subscription.plano.beneficios_json?.map((benefit, index) => (
                    <div key={index} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-gold flex-shrink-0" />
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-8 text-xs hover:bg-primary/10 transition-all duration-300 mt-4"
                  onClick={() => {
                    toast.info("Gerenciamento de plano em breve");
                  }}
                >
                  Gerenciar Plano
                </Button>
              </div>
            </Card>
          ) : (
            <div className="text-center py-12 space-y-6">
              <Gift className="w-16 h-16 mx-auto text-muted-foreground opacity-50" />
              <div className="space-y-2">
                <p className="text-sm font-medium">Você ainda não possui um plano ativo</p>
                <p className="text-xs text-muted-foreground">
                  Assine um plano e aproveite benefícios exclusivos
                </p>
              </div>
              <Button
                onClick={() => {
                  onOpenChange(false);
                  setTimeout(() => onSubscribe(), 300);
                }}
                className="h-12 px-8 bg-primary hover:bg-primary/90 transition-all duration-300"
              >
                Assinar um Plano
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
