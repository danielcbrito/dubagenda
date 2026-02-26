import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  ExternalLink,
  Loader2,
  AlertCircle,
  RefreshCw,
  Settings,
} from "lucide-react";
import { BackArrow } from "@/components/ui/back-arrow";
import { toast } from "sonner";
import { motion } from "framer-motion";

/**
 * Tela de gerenciamento de pagamento da assinatura via Stripe Customer Portal
 */
const ClientePagamento = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);

  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Você precisa estar logado.");
        return;
      }

      const { data: sub, error: subError } = await supabase
        .from("assinaturas")
        .select("*, planos(*)")
        .eq("user_id", session.user.id)
        .eq("status", "active")
        .maybeSingle();

      if (subError) throw subError;

      if (!sub) {
        setError("Nenhuma assinatura ativa encontrada.");
        return;
      }

      setSubscription(sub);
    } catch (err: any) {
      console.error("Error loading subscription:", err);
      setError(err.message || "Erro ao carregar assinatura.");
    } finally {
      setLoading(false);
    }
  };

  /** Abre o Stripe Customer Portal para gerenciar pagamento */
  const handleOpenPortal = async () => {
    setOpeningPortal(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("customer-portal");

      if (fnError) throw fnError;

      if (data?.url) {
        window.open(data.url, "_blank");
      } else {
        toast.error("Erro ao abrir portal de pagamento.");
      }
    } catch (err: any) {
      console.error("Error opening customer portal:", err);
      toast.error(err.message || "Erro ao abrir portal de pagamento");
    } finally {
      setOpeningPortal(false);
    }
  };

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <div className="px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate("/cliente")}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted/50 transition-colors"
          >
            <BackArrow size={18} className="text-foreground" />
          </button>
          <p className="text-sm font-semibold text-foreground tracking-tight">
            Formas de Pagamento
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center pt-20 gap-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Carregando...</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center pt-20 gap-6">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-foreground">Erro</p>
              <p className="text-xs text-muted-foreground max-w-xs">{error}</p>
            </div>
            <Button onClick={loadSubscription} variant="default" className="h-11 px-6">
              <RefreshCw className="w-4 h-4 mr-2" />
              Tentar Novamente
            </Button>
          </div>
        )}

        {/* Content */}
        {!loading && !error && subscription && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            {/* Plano resumo */}
            <div className="rounded-2xl border border-border/40 bg-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">
                    Plano atual
                  </p>
                  <p className="text-lg font-bold text-foreground">
                    {subscription.planos?.nome || "Plano"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">
                    R$ {Number(subscription.planos?.preco_mensal || 0).toFixed(2).replace(".", ",")}
                  </p>
                  <p className="text-xs text-muted-foreground">/mês</p>
                </div>
              </div>
            </div>

            {/* Método de pagamento */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                Método de pagamento
              </h3>

              <div className="rounded-2xl border border-border/40 bg-card p-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <CreditCard className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">
                      {subscription.payment_method === "card" ? "Cartão de Crédito" : "Stripe"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Gerenciado pelo Stripe
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Ação: Abrir portal Stripe */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                Gerenciar pagamento
              </h3>

              <button
                onClick={handleOpenPortal}
                disabled={openingPortal}
                className="w-full rounded-2xl border border-border/40 bg-card p-5 text-left transition-all hover:border-primary/20 hover:shadow-md group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-muted/60 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    {openingPortal ? (
                      <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    ) : (
                      <Settings className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-foreground">
                      Abrir Portal de Pagamento
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Alterar cartão, visualizar faturas e gerenciar assinatura
                    </p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground/40" />
                </div>
              </button>
            </div>

            {/* Info */}
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted/50 border border-border/30">
              <RefreshCw className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                Sua assinatura renova automaticamente via Stripe
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default ClientePagamento;
