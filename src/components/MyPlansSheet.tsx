import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Gift, Calendar, CheckCircle2, AlertCircle, Loader2, XCircle, ArrowLeft, Crown, CreditCard, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
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

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
      active: { label: "Ativo", variant: "default" },
      suspended: { label: "Pagamento Pendente", variant: "destructive" },
      past_due: { label: "Vencido", variant: "destructive" },
      cancelled: { label: "Cancelado", variant: "secondary" },
    };
    return statusMap[status] || { label: status, variant: "secondary" };
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
      // Notificar o dashboard para recarregar dados imediatamente
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
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border/40">
              <button
                onClick={() => onOpenChange(false)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-card hover:bg-muted transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-foreground" />
              </button>
              <h1 className="text-lg font-bold text-foreground">Meus Planos</h1>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-6">
              {/* Loading */}
              {loadingState === "loading" && (
                <div className="space-y-4">
                  <Skeleton className="h-6 w-3/4 bg-muted" />
                  <Skeleton className="h-4 w-full bg-muted" />
                  <Skeleton className="h-4 w-2/3 bg-muted" />
                  <Skeleton className="h-40 w-full rounded-2xl bg-muted" />
                </div>
              )}

              {/* Error */}
              {loadingState === "error" && (
                <div className="flex flex-col items-center justify-center pt-20 space-y-6">
                  <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-destructive" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-medium text-foreground">Erro ao carregar</p>
                    <p className="text-xs text-muted-foreground max-w-xs">
                      {errorMessage}
                    </p>
                  </div>
                  <Button onClick={loadSubscription} variant="default" className="h-11 px-6">
                    <Loader2 className="w-4 h-4 mr-2" />
                    Tentar Novamente
                  </Button>
                </div>
              )}

              {/* Empty */}
              {loadingState === "success" && !subscription && (
                <div className="flex flex-col items-center justify-center pt-20 space-y-6">
                  <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
                    <Crown className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-medium text-foreground">Nenhum plano ativo</p>
                    <p className="text-xs text-muted-foreground">
                      Assine um plano e aproveite benefícios exclusivos
                    </p>
                  </div>
                  <Button
                    onClick={handleSubscribeClick}
                    className="h-12 px-8 bg-primary hover:bg-primary/90 transition-all"
                  >
                    Assinar um Plano
                  </Button>
                </div>
              )}

              {/* Subscription Card */}
              {loadingState === "success" && subscription && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  {/* Plan Header */}
                  <div className="rounded-2xl border border-border/40 bg-card p-6 space-y-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-1">
                        <h2 className="text-xl font-bold text-foreground">
                          {subscription.plano.nome}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          {subscription.plano.descricao}
                        </p>
                      </div>
                      <Badge variant={getStatusBadge(subscription.status).variant}>
                        {getStatusBadge(subscription.status).label}
                      </Badge>
                    </div>

                    {/* Price */}
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-primary">
                        R$ {Number(subscription.plano.preco_mensal || 0).toFixed(2).replace(".", ",")}
                      </span>
                      <span className="text-sm text-muted-foreground">/mês</span>
                    </div>

                    {/* Next billing - only for active */}
                    {!isSuspended && subscription.next_billing_date && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>
                          Próxima cobrança:{" "}
                          {format(new Date(subscription.next_billing_date), "dd 'de' MMMM", { locale: ptBR })}
                        </span>
                      </div>
                    )}

                    {/* Suspended: Finalize payment CTA */}
                    {isSuspended && (
                      <div className="pt-1">
                        <p className="text-xs text-muted-foreground mb-3">
                          Finalize o pagamento para ativar seus benefícios.
                        </p>
                        <Button
                          onClick={() => {
                            onOpenChange(false);
                            setTimeout(() => navigate("/cliente/assinar", { 
                              state: { resumePlanId: subscription.plano?.id || null }
                            }), 300);
                          }}
                          className="w-full h-12 bg-primary hover:bg-primary/90 font-semibold"
                        >
                          Finalizar pagamento
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Benefits */}
                  {benefits.length > 0 && (
                    <div className="rounded-2xl border border-border/40 bg-card p-6 space-y-4">
                      <h3 className="text-sm font-semibold text-foreground">
                        Benefícios inclusos
                      </h3>
                      <div className="space-y-3">
                        {benefits.map((benefit: string, i: number) => (
                          <div key={i} className="flex items-start gap-3">
                            <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                            <span className="text-sm text-muted-foreground">{benefit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Gerenciar pagamento - only for active */}
                  {!isSuspended && (
                    <button
                      onClick={() => {
                        onOpenChange(false);
                        setTimeout(() => navigate("/cliente/pagamento"), 300);
                      }}
                      className="w-full rounded-2xl border border-border/40 bg-card p-5 flex items-center justify-between hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <CreditCard className="w-5 h-5 text-primary" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-foreground">Formas de Pagamento</p>
                          <p className="text-xs text-muted-foreground">
                            {subscription.payment_method === 'card' ? 'Cartão de crédito • Débito automático' : 'PIX mensal'}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                  )}

                  {/* Cancel */}
                  <button
                    onClick={() => setCancelDialogOpen(true)}
                    className="w-full py-3 text-sm text-destructive hover:text-destructive/80 transition-colors"
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
