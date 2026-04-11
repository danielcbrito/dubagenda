import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import { BackArrow } from "@/components/ui/back-arrow";
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
  barbeiro_id?: string | null;
  plano: {
    id: string;
    nome: string;
    descricao: string;
    preco_mensal: number;
    beneficios_json: any;
    limite_agendamentos_mes?: number;
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
  const [rpcUsageCount, setRpcUsageCount] = useState(0);

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
          total_renovacoes,
          barbeiro_id,
          plano:planos(
            id,
            nome,
            descricao,
            preco_mensal,
            beneficios_json,
            limite_agendamentos_mes
          )
        `)
        .eq("user_id", userId)
        .in("status", ["active", "suspended", "pending_cash"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error loading subscription:", error);
        setLoadingState("error");
        setErrorMessage("Não foi possível carregar os dados do plano. Tente novamente.");
        toast.error("Erro ao carregar plano");
      } else if (!data) {
        onOpenChange(false);
        navigate("/cliente/assinar");
      } else {
        setSubscription(data);

        // Use the same RPC as the home dashboard for accurate usage count
        if (data.next_billing_date) {
          const cycleStart = new Date(`${data.next_billing_date}T12:00:00`);
          cycleStart.setMonth(cycleStart.getMonth() - 1);
          const cycleStartDate = cycleStart.toISOString().split('T')[0];

          const { data: usageCount, error: usageError } = await supabase.rpc('count_subscription_uses_in_cycle', {
            p_assinatura_id: data.id,
            p_cycle_start: cycleStartDate,
            p_cycle_end: data.next_billing_date,
          });

          setRpcUsageCount(usageError ? 0 : Number(usageCount || 0));
        } else {
          setRpcUsageCount(0);
        }

        setLoadingState("success");
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      setLoadingState("error");
      setErrorMessage("Erro inesperado ao carregar planos. Verifique sua conexão.");
    }
  };

  const isSuspended = subscription?.status === "suspended";
  const isPendingCash = subscription?.status === "pending_cash";

  const usosAtual = rpcUsageCount;
  const limite = (subscription as any)?.plano?.limite_agendamentos_mes || 0;
  const usosRestantes = Math.max(0, limite - usosAtual);
  const isExhausted = limite > 0 && usosRestantes <= 0;
  const progressPct = limite > 0 ? Math.min(100, (usosAtual / limite) * 100) : 0;

  const handleCancelSubscription = async () => {
    setCanceling(true);
    try {
      const { error } = await supabase.functions.invoke("cancel-subscription");
      if (error) throw error;
      toast.success("Assinatura cancelada com sucesso");
      setCancelDialogOpen(false);
      setSubscription(null);
      onOpenChange(false);
      onSubscriptionChanged?.();
    } catch (error: any) {
      console.error("Cancel subscription error:", error);
      toast.error("Erro ao cancelar assinatura: " + error.message);
    } finally {
      setCanceling(false);
    }
  };

  if (!open) return null;

  const statusLabel = (() => {
    switch (subscription?.status) {
      case "active": return "Ativo";
      case "suspended": return "Pendente";
      case "pending_cash": return "Aguardando";
      case "past_due": return "Vencido";
      case "cancelled": return "Cancelado";
      default: return subscription?.status || "";
    }
  })();

  const statusDot = (() => {
    switch (subscription?.status) {
      case "active": return "bg-emerald-500";
      case "suspended": return "bg-primary";
      case "pending_cash": return "bg-amber-500";
      case "past_due": return "bg-destructive";
      default: return "bg-muted-foreground";
    }
  })();

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
            {/* Header */}
            <div className="px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 flex items-center gap-3">
              <button
                onClick={() => onOpenChange(false)}
                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors active:scale-95"
              >
                <BackArrow size={22} className="text-foreground" />
              </button>
              <h1 className="text-[15px] font-semibold text-foreground">Meu Plano</h1>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <div className="px-4 pb-24">

                {/* Loading */}
                {loadingState === "loading" && (
                  <div className="space-y-3 pt-4">
                    <Skeleton className="h-32 w-full rounded-xl bg-muted" />
                    <Skeleton className="h-16 w-full rounded-xl bg-muted" />
                  </div>
                )}

                {/* Error */}
                {loadingState === "error" && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center pt-20 space-y-4"
                  >
                    <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                      <AlertCircle className="w-5 h-5 text-destructive" />
                    </div>
                    <div className="text-center space-y-1.5">
                      <p className="text-sm font-semibold text-foreground">Erro ao carregar</p>
                      <p className="text-xs text-muted-foreground max-w-[260px] leading-relaxed">{errorMessage}</p>
                    </div>
                    <button
                      onClick={loadSubscription}
                      className="flex items-center gap-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors mt-2"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Tentar novamente
                    </button>
                  </motion.div>
                )}

                {/* Empty — no plan */}
                {loadingState === "success" && !subscription && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="pt-16 flex flex-col items-center"
                  >
                    <h2 className="text-lg font-bold text-foreground tracking-tight mb-2">
                      Nenhum plano ativo
                    </h2>
                    <p className="text-[13px] text-muted-foreground text-center max-w-[260px] mb-8 leading-relaxed">
                      Assine um plano e aproveite preços exclusivos e agendamento prioritário.
                    </p>
                    <button
                      onClick={() => {
                        onOpenChange(false);
                        navigate("/cliente/assinar");
                      }}
                      className={cn(
                        "w-full h-[48px] rounded-xl font-semibold text-[13px]",
                        "bg-foreground text-background",
                        "flex items-center justify-center gap-2",
                        "active:scale-[0.98] transition-transform"
                      )}
                    >
                      Ver planos disponíveis
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}

                {/* Active subscription */}
                {loadingState === "success" && subscription && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-5 pt-2"
                  >
                    {/* Plan hero */}
                    <div className="text-center pt-4 pb-2">
                      <div className="flex items-center justify-center gap-2 mb-4">
                        <span className={cn("w-2 h-2 rounded-full", statusDot)} />
                        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                          {statusLabel}
                        </span>
                      </div>

                      <h2 className="text-xl font-bold text-foreground tracking-tight mb-1">
                        {subscription.plano.nome}
                      </h2>
                      {subscription.plano.descricao && (
                        <p className="text-[12px] text-muted-foreground leading-relaxed max-w-[280px] mx-auto">
                          {subscription.plano.descricao}
                        </p>
                      )}

                      <div className="mt-5 flex items-baseline justify-center gap-0.5">
                        <span className="text-[11px] text-muted-foreground font-medium">R$</span>
                        <span className="text-[40px] font-bold text-foreground tabular-nums leading-none tracking-tight">
                          {Math.floor(subscription.plano.preco_mensal || 0)}
                        </span>
                        <span className="text-[18px] font-bold text-foreground tabular-nums">
                          ,{((subscription.plano.preco_mensal || 0) % 1 * 100).toFixed(0).padStart(2, "0")}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-medium ml-0.5">/mês</span>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-border/30" />

                    {/* Details */}
                    <div className="space-y-0 divide-y divide-border/20">
                      {/* Usage */}
                      {limite > 0 && (
                        <div className="py-3.5 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                              Uso do ciclo
                            </span>
                            <span className="text-[13px] font-bold text-foreground tabular-nums">
                              {usosAtual}<span className="text-muted-foreground font-normal text-[11px]"> / {limite}</span>
                            </span>
                          </div>
                          <div className="h-[6px] rounded-full bg-muted/60 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${progressPct}%` }}
                              transition={{ duration: 0.6, ease: "easeOut" }}
                              className={cn(
                                "h-full rounded-full transition-colors",
                                isExhausted ? "bg-primary" : "bg-foreground/70"
                              )}
                            />
                          </div>
                          {isExhausted && (
                            <p className="text-[11px] font-medium text-primary">
                              Todos os usos foram consumidos
                            </p>
                          )}
                        </div>
                      )}

                      {/* Next billing */}
                      {!isSuspended && subscription.next_billing_date && (
                        <div className="py-3.5 flex items-center justify-between">
                          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                            Próxima renovação
                          </span>
                          <span className="text-[13px] font-semibold text-foreground">
                            {format(new Date(subscription.next_billing_date), "dd 'de' MMMM", { locale: ptBR })}
                          </span>
                        </div>
                      )}

                      {/* Payment method */}
                      <div className="py-3.5 flex items-center justify-between">
                        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                          Pagamento
                        </span>
                        <span className="text-[13px] font-semibold text-foreground">
                          {subscription.payment_method === "cash"
                            ? "Dinheiro"
                            : subscription.payment_method === "card"
                              ? "Cartão"
                              : "PIX"}
                        </span>
                      </div>

                      {/* Renewals count */}
                      {(subscription as any).total_renovacoes > 0 && (
                        <div className="py-3.5 flex items-center justify-between">
                          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                            Renovações
                          </span>
                          <span className="text-[13px] font-semibold text-foreground tabular-nums">
                            {(subscription as any).total_renovacoes}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Pending cash info */}
                    {isPendingCash && (
                      <p className="text-[11px] text-muted-foreground bg-muted/50 border border-border/30 rounded-lg px-3 py-2.5 leading-relaxed">
                        Apresente o pagamento em dinheiro ao barbeiro para ativar o plano.
                      </p>
                    )}

                    {/* Suspended CTA */}
                    {isSuspended && (
                      <div className="space-y-2">
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Finalize o pagamento para ativar seus benefícios.
                        </p>
                        <Button
                          onClick={() => {
                            onOpenChange(false);
                            navigate("/cliente/assinar", {
                              state: { resumePlanId: subscription.plano?.id || null },
                            });
                          }}
                          className="w-full h-11 text-[13px] font-semibold rounded-xl"
                        >
                          Finalizar pagamento
                        </Button>
                      </div>
                    )}

                    {/* Renewal CTAs — only when exhausted */}
                    {isExhausted && !isSuspended && !isPendingCash && (
                      <div className="space-y-2.5 pt-2">
                        <button
                          onClick={() => {
                            onOpenChange(false);
                            const barberId = (subscription as any).barbeiro_id;
                            if (barberId) {
                              navigate(`/cliente/agendar?barber=${barberId}`);
                            } else {
                              navigate("/cliente/assinar");
                            }
                          }}
                          className={cn(
                            "w-full h-[48px] rounded-xl font-semibold text-[13px]",
                            "bg-foreground text-background",
                            "flex items-center justify-center gap-2",
                            "active:scale-[0.98] transition-transform"
                          )}
                        >
                          Renovar plano
                        </button>
                        <button
                          onClick={() => {
                            onOpenChange(false);
                            navigate("/cliente/assinar");
                          }}
                          className={cn(
                            "w-full h-[48px] rounded-xl font-medium text-[13px]",
                            "border border-border/40 text-foreground",
                            "flex items-center justify-center gap-2",
                            "hover:bg-muted/40 active:scale-[0.98] transition-all"
                          )}
                        >
                          Escolher outro plano
                        </button>
                      </div>
                    )}

                    {/* Cancel */}
                    <div className="pt-8">
                      <button
                        onClick={() => setCancelDialogOpen(true)}
                        className="w-full py-2 text-[11px] text-muted-foreground/35 hover:text-destructive/60 transition-colors"
                      >
                        {isSuspended || isPendingCash ? "Cancelar assinatura pendente" : "Cancelar assinatura"}
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent className="max-w-[340px] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px]">Cancelar Assinatura</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] leading-relaxed">
              Tem certeza que deseja cancelar sua assinatura? Você perderá acesso aos benefícios do plano.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel disabled={canceling} className="rounded-xl text-[13px]">
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelSubscription}
              disabled={canceling}
              className="rounded-xl text-[13px] bg-destructive hover:bg-destructive/90"
            >
              {canceling ? "Cancelando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
