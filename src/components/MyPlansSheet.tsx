import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, CheckCircle2, AlertCircle, Loader2, ArrowLeft, Crown, CreditCard, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Subscription {
  id: string;
  status: string;
  next_billing_date: string | null;
  payment_method: string | null;
  plano: {
    id: string;
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
  onSubscriptionChanged?: () => void;
}

type LoadingState = "idle" | "loading" | "error" | "success";

export function MyPlansSheet({ open, onOpenChange, userId, onSubscriptionChanged }: MyPlansSheetProps) {
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    if (open && userId) {
      loadSubscription();
    }
  }, [open, userId]);

  const loadSubscription = async () => {
    if (!userId) {
      setLoadingState("error");
      setErrorMessage("Usuário não autenticado");
      return;
    }

    setLoadingState("loading");
    setErrorMessage("");
    
    try {
      const { data, error } = await supabase
        .from("assinaturas")
        .select(`
          id,
          status,
          next_billing_date,
          payment_method,
          plano:planos(
            id,
            nome,
            descricao,
            preco_mensal,
            beneficios_json
          )
        `)
        .eq("user_id", userId)
        .in("status", ["active", "suspended"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error loading subscription:", error);
        setLoadingState("error");
        setErrorMessage("Não foi possível carregar os dados do plano. Tente novamente.");
        toast.error("Erro ao carregar plano");
      } else {
        setSubscription(data);
        setLoadingState("success");
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      setLoadingState("error");
      setErrorMessage("Erro inesperado ao carregar planos. Verifique sua conexão.");
    }
  };

  const getStatusConfig = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      active: { 
        label: "ATIVO", 
        className: "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20" 
      },
      suspended: { 
        label: "PENDENTE", 
        className: "bg-primary/10 text-primary ring-1 ring-primary/20" 
      },
      past_due: { 
        label: "VENCIDO", 
        className: "bg-destructive/10 text-destructive ring-1 ring-destructive/20" 
      },
      cancelled: { 
        label: "CANCELADO", 
        className: "bg-muted text-muted-foreground ring-1 ring-border" 
      },
    };
    return map[status] || { label: status, className: "bg-muted text-muted-foreground" };
  };

  const isSuspended = subscription?.status === "suspended";

  const handleSubscribeClick = () => {
    onOpenChange(false);
    setTimeout(() => navigate("/cliente/assinar"), 300);
  };

  const handleCancelSubscription = async () => {
    setCanceling(true);
    try {
      const { error } = await supabase.functions.invoke('cancel-subscription');
      if (error) throw error;
      toast.success("Assinatura cancelada com sucesso");
      setCancelDialogOpen(false);
      setSubscription(null);
      onOpenChange(false);
      onSubscriptionChanged?.();
    } catch (error: any) {
      console.error('Cancel subscription error:', error);
      toast.error("Erro ao cancelar assinatura: " + error.message);
    } finally {
      setCanceling(false);
    }
  };

  if (!open) return null;

  const benefits = Array.isArray(subscription?.plano?.beneficios_json) 
    ? subscription.plano.beneficios_json 
    : [];

  const statusConfig = subscription ? getStatusConfig(subscription.status) : null;

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-50 bg-background flex flex-col"
          >
            {/* Header — compacto, só seta + título */}
            <div className="flex items-center gap-3 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3">
              <button
                onClick={() => onOpenChange(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-card border border-border/40 hover:bg-muted transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-foreground" />
              </button>
              <h1 className="text-sm font-semibold text-foreground tracking-tight">Meus Planos</h1>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-24">
              {/* Loading */}
              {loadingState === "loading" && (
                <div className="space-y-3 pt-2">
                  <Skeleton className="h-5 w-2/3 bg-muted" />
                  <Skeleton className="h-4 w-full bg-muted" />
                  <Skeleton className="h-32 w-full rounded-xl bg-muted" />
                </div>
              )}

              {/* Error */}
              {loadingState === "error" && (
                <div className="flex flex-col items-center justify-center pt-16 space-y-5">
                  <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-destructive" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-medium text-foreground">Erro ao carregar</p>
                    <p className="text-xs text-muted-foreground max-w-[260px]">{errorMessage}</p>
                  </div>
                  <Button onClick={loadSubscription} size="sm" className="h-9 px-5">
                    <Loader2 className="w-3.5 h-3.5 mr-1.5" />
                    Tentar Novamente
                  </Button>
                </div>
              )}

              {/* Empty — Sem plano ativo */}
              {loadingState === "success" && !subscription && (
                <div className="flex flex-col items-center justify-center pt-16 space-y-5">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <Crown className="w-6 h-6 text-primary" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-semibold text-foreground">Nenhum plano ativo</p>
                    <p className="text-xs text-muted-foreground max-w-[240px]">
                      Assine e tenha acesso a benefícios exclusivos com preços especiais.
                    </p>
                  </div>
                  <Button
                    onClick={handleSubscribeClick}
                    className="h-10 px-6 text-sm font-semibold"
                  >
                    <Crown className="w-4 h-4 mr-1.5" />
                    Assinar um Plano
                  </Button>
                </div>
              )}

              {/* Subscription Active */}
              {loadingState === "success" && subscription && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3 pt-1"
                >
                  {/* Plan Card Principal */}
                  <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
                    {/* Accent line */}
                    <div className="h-0.5 bg-gradient-to-r from-primary via-primary/60 to-transparent" />

                    <div className="p-4 space-y-3.5">
                      {/* Nome + Status badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h2 className="text-base font-bold text-foreground truncate">
                            {subscription.plano.nome}
                          </h2>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {subscription.plano.descricao}
                          </p>
                        </div>
                        {statusConfig && (
                          <span className={cn(
                            "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md shrink-0",
                            statusConfig.className
                          )}>
                            {statusConfig.label}
                          </span>
                        )}
                      </div>

                      {/* Preço */}
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-2xl font-bold text-primary tabular-nums">
                          R$ {Number(subscription.plano.preco_mensal || 0).toFixed(2).replace(".", ",")}
                        </span>
                        <span className="text-xs text-muted-foreground">/mês</span>
                      </div>

                      {/* Próxima cobrança */}
                      {!isSuspended && subscription.next_billing_date && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            Renova em{" "}
                            <span className="text-foreground font-medium">
                              {format(new Date(subscription.next_billing_date), "dd 'de' MMM", { locale: ptBR })}
                            </span>
                          </span>
                        </div>
                      )}

                      {/* Suspended CTA */}
                      {isSuspended && (
                        <div className="pt-1">
                          <p className="text-[11px] text-muted-foreground mb-2">
                            Finalize o pagamento para ativar seus benefícios.
                          </p>
                          <Button
                            onClick={() => {
                              onOpenChange(false);
                              setTimeout(() => navigate("/cliente/assinar", { 
                                state: { resumePlanId: subscription.plano?.id || null }
                              }), 300);
                            }}
                            className="w-full h-10 text-sm font-semibold"
                          >
                            Finalizar pagamento
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Benefícios */}
                  {benefits.length > 0 && (
                    <div className="rounded-xl border border-border/40 bg-card p-4 space-y-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                        BENEFÍCIOS INCLUSOS
                      </p>
                      <div className="space-y-2">
                        {benefits.map((benefit: string, i: number) => (
                          <div key={i} className="flex items-start gap-2.5">
                            <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-primary flex-shrink-0" />
                            <span className="text-xs text-muted-foreground">{benefit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Gerenciar pagamento */}
                  {!isSuspended && (
                    <button
                      onClick={() => {
                        onOpenChange(false);
                        setTimeout(() => navigate("/cliente/pagamento"), 300);
                      }}
                      className="w-full rounded-xl border border-border/40 bg-card p-3.5 flex items-center justify-between hover:bg-muted/50 transition-colors active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <CreditCard className="w-4 h-4 text-primary" />
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-semibold text-foreground">Formas de Pagamento</p>
                          <p className="text-[11px] text-muted-foreground">
                            {subscription.payment_method === 'card' ? 'Cartão • Débito automático' : 'PIX mensal'}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  )}

                  {/* Cancel */}
                  <button
                    onClick={() => setCancelDialogOpen(true)}
                    className="w-full py-2.5 text-xs text-destructive/70 hover:text-destructive transition-colors"
                  >
                    {isSuspended ? "Cancelar assinatura pendente" : "Cancelar assinatura"}
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Assinatura</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar sua assinatura? Você perderá acesso aos benefícios do plano.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={canceling}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelSubscription}
              disabled={canceling}
              className="bg-destructive hover:bg-destructive/90"
            >
              {canceling ? "Cancelando..." : "Confirmar Cancelamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
