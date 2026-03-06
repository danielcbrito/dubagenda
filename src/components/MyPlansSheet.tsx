import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  CheckCircle2,
  AlertCircle,
  Loader2,
  CreditCard,
  ChevronRight,
  Sparkles,
  ArrowRight,
  RefreshCw,
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
        .in("status", ["active", "suspended", "pending_cash"])
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
    const map: Record<string, { label: string; className: string; dotColor: string }> = {
      active: {
        label: "Ativo",
        className: "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400",
        dotColor: "bg-emerald-500",
      },
      suspended: {
        label: "Pendente",
        className: "bg-primary/10 text-primary",
        dotColor: "bg-primary",
      },
      pending_cash: {
        label: "Aguardando",
        className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        dotColor: "bg-amber-500",
      },
      past_due: {
        label: "Vencido",
        className: "bg-destructive/10 text-destructive",
        dotColor: "bg-destructive",
      },
      cancelled: {
        label: "Cancelado",
        className: "bg-muted text-muted-foreground",
        dotColor: "bg-muted-foreground",
      },
    };
    return map[status] || { label: status, className: "bg-muted text-muted-foreground", dotColor: "bg-muted-foreground" };
  };

  const isSuspended = subscription?.status === "suspended";
  const isPendingCash = subscription?.status === "pending_cash";

  const handleSubscribeClick = () => {
    navigate("/cliente/assinar");
  };

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

  const benefits = Array.isArray(subscription?.plano?.beneficios_json)
    ? subscription.plano.beneficios_json
    : [];

  const statusConfig = subscription ? getStatusConfig(subscription.status) : null;

  const paymentLabel =
    subscription?.payment_method === "cash"
      ? "Dinheiro"
      : subscription?.payment_method === "card"
        ? "Cartão"
        : "PIX";

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
            {/* ── Header ── */}
            <div className="px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2">
              <button
                onClick={() => onOpenChange(false)}
                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors active:scale-95"
              >
                <BackArrow size={22} className="text-foreground" />
              </button>
            </div>

            {/* ── Content ── */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <div className="px-4 pb-24 pt-5">

                {/* Loading */}
                {loadingState === "loading" && (
                  <div className="space-y-4 pt-4">
                    <Skeleton className="h-28 w-full rounded-xl bg-muted" />
                    <Skeleton className="h-20 w-full rounded-xl bg-muted" />
                    <Skeleton className="h-14 w-full rounded-xl bg-muted" />
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

                {/* ── Empty State ── */}
                {loadingState === "success" && !subscription && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="pt-4"
                  >
                    {/* Visual top */}
                    <div className="text-center mb-8">
                      <div className="w-16 h-16 rounded-2xl bg-primary/8 dark:bg-primary/10 flex items-center justify-center mx-auto mb-5">
                        <Sparkles className="w-7 h-7 text-primary" strokeWidth={1.5} />
                      </div>
                      <h2 className="text-lg font-bold text-foreground tracking-tight mb-1.5">
                        Você ainda não tem um plano
                      </h2>
                      <p className="text-[13px] text-muted-foreground leading-relaxed max-w-[280px] mx-auto">
                        Assine e aproveite preços exclusivos, agendamento prioritário e benefícios especiais.
                      </p>
                    </div>

                    {/* Benefit highlights */}
                    <div className="space-y-2.5 mb-8">
                      {[
                        "Preços especiais em todos os serviços",
                        "Agendamento com prioridade",
                        "Benefícios exclusivos para assinantes",
                      ].map((text, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.15 + i * 0.08 }}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border/30"
                        >
                          <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" strokeWidth={2} />
                          <span className="text-[13px] text-foreground">{text}</span>
                        </motion.div>
                      ))}
                    </div>

                    {/* CTA */}
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                    >
                      <button
                        onClick={handleSubscribeClick}
                        className={cn(
                          "w-full h-12 rounded-xl font-semibold text-sm",
                          "bg-foreground text-background",
                          "flex items-center justify-center gap-2",
                          "active:scale-[0.98] transition-all"
                        )}
                      >
                        Ver planos disponíveis
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </motion.div>
                  </motion.div>
                )}

                {/* ── Subscription Active ── */}
                {loadingState === "success" && subscription && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    {/* Plan card */}
                    <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
                      <div className="h-[2px] bg-gradient-to-r from-primary via-primary/50 to-transparent" />

                      <div className="p-4 space-y-4">
                        {/* Name + Status */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h2 className="text-base font-bold text-foreground truncate">
                              {subscription.plano.nome}
                            </h2>
                            {subscription.plano.descricao && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                                {subscription.plano.descricao}
                              </p>
                            )}
                          </div>
                          {statusConfig && (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-lg shrink-0",
                                statusConfig.className
                              )}
                            >
                              <span className={cn("w-1.5 h-1.5 rounded-full", statusConfig.dotColor)} />
                              {statusConfig.label}
                            </span>
                          )}
                        </div>

                        {/* Price */}
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold text-foreground tabular-nums">
                            R$ {Number(subscription.plano.preco_mensal || 0).toFixed(2).replace(".", ",")}
                          </span>
                          <span className="text-xs text-muted-foreground">/mês</span>
                        </div>

                        {/* Meta info row */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                          {!isSuspended && subscription.next_billing_date && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Calendar className="w-3.5 h-3.5" />
                              <span>
                                Renova{" "}
                                <span className="text-foreground font-medium">
                                  {format(new Date(subscription.next_billing_date), "dd MMM", { locale: ptBR })}
                                </span>
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>{paymentLabel}</span>
                          </div>
                        </div>

                        {/* Pending Cash info */}
                        {isPendingCash && (
                          <p className="text-[11px] text-muted-foreground bg-amber-500/5 dark:bg-amber-500/8 border border-amber-500/15 rounded-lg px-3 py-2">
                            Apresente o pagamento em dinheiro ao barbeiro para ativar o plano.
                          </p>
                        )}

                        {/* Suspended CTA */}
                        {isSuspended && (
                          <div className="space-y-2">
                            <p className="text-[11px] text-muted-foreground">
                              Finalize o pagamento para ativar seus benefícios.
                            </p>
                            <Button
                              onClick={() => {
                                onOpenChange(false);
                                setTimeout(
                                  () =>
                                    navigate("/cliente/assinar", {
                                      state: { resumePlanId: subscription.plano?.id || null },
                                    }),
                                  300
                                );
                              }}
                              className="w-full h-10 text-sm font-semibold"
                            >
                              Finalizar pagamento
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Benefits */}
                    {benefits.length > 0 && (
                      <div className="rounded-xl border border-border/40 bg-card p-4 space-y-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/50">
                          Benefícios inclusos
                        </p>
                        <div className="space-y-2.5">
                          {benefits.map((benefit: string, i: number) => (
                            <div key={i} className="flex items-start gap-2.5">
                              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-primary flex-shrink-0" />
                              <span className="text-xs text-muted-foreground leading-relaxed">{benefit}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Payment management */}
                    {!isSuspended && (
                      <button
                        onClick={() => {
                          onOpenChange(false);
                          setTimeout(() => navigate("/cliente/pagamento"), 300);
                        }}
                        className="w-full rounded-xl border border-border/40 bg-card p-3.5 flex items-center justify-between hover:bg-muted/50 transition-colors active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-secondary/60 flex items-center justify-center">
                            <CreditCard className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <p className="text-xs font-medium text-foreground">Formas de Pagamento</p>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
                      </button>
                    )}

                    {/* Cancel */}
                    <div className="pt-4">
                      <button
                        onClick={() => setCancelDialogOpen(true)}
                        className="w-full py-2 text-[11px] text-muted-foreground/50 hover:text-destructive/70 transition-colors"
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
