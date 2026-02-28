import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Crown, User, Banknote, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface PendingCashSub {
  id: string;
  created_at: string;
  user_id: string;
  plano_id: string;
  barbeiro_id: string | null;
  profile: { nome: string; telefone: string | null } | null;
  plano: { nome: string; preco_mensal: number } | null;
}

export function AdminPendingCashSubscriptions() {
  const [subs, setSubs] = useState<PendingCashSub[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    loadPending();

    const channel = supabase
      .channel('admin-pending-cash-subs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assinaturas' }, () => {
        loadPending();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadPending = async () => {
    setLoading(true);
    try {
      // Buscar assinaturas cash ativas mas ainda não confirmadas (cash_payment_confirmed = false)
      // E também as antigas pending_cash por retrocompatibilidade
      const { data, error } = await supabase
        .from("assinaturas")
        .select("id, created_at, user_id, plano_id, barbeiro_id, status, cash_payment_confirmed")
        .eq("payment_method", "cash")
        .or("status.eq.pending_cash,and(status.eq.active,cash_payment_confirmed.eq.false)" as any)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const withDetails = await Promise.all(
        (data || []).map(async (sub) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("nome, telefone")
            .eq("id", sub.user_id)
            .single();

          const { data: plano } = await supabase
            .from("planos")
            .select("nome, preco_mensal")
            .eq("id", sub.plano_id)
            .single();

          return { ...sub, profile: profile || null, plano: plano || null };
        })
      );

      setSubs(withDetails);
    } catch (error) {
      console.error("Erro ao carregar assinaturas pendentes:", error);
      toast.error("Erro ao carregar assinaturas pendentes");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (sub: PendingCashSub) => {
    setProcessing(sub.id);
    try {
      const nextBilling = new Date();
      nextBilling.setMonth(nextBilling.getMonth() + 1);

      const { error } = await supabase
        .from("assinaturas")
        .update({
          status: "active" as any,
          cash_payment_confirmed: true,
          next_billing_date: format(nextBilling, "yyyy-MM-dd"),
        })
        .eq("id", sub.id);

      if (error) throw error;

      toast.success(`✅ Pagamento confirmado e plano liberado para ${sub.profile?.nome || "cliente"}!`);
      loadPending();
    } catch (error) {
      console.error("Erro ao confirmar:", error);
      toast.error("Erro ao confirmar pagamento");
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (sub: PendingCashSub) => {
    setProcessing(sub.id);
    try {
      const { error } = await supabase
        .from("assinaturas")
        .delete()
        .eq("id", sub.id);

      if (error) throw error;

      toast.success("❌ Solicitação recusada");
      loadPending();
    } catch (error) {
      console.error("Erro ao recusar:", error);
      toast.error("Erro ao recusar solicitação");
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (subs.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Banknote className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
          Planos Aguardando Pagamento em Dinheiro
        </h3>
        <Badge variant="secondary" className="text-[10px] font-bold tabular-nums">
          {subs.length}
        </Badge>
      </div>

      <div className="grid gap-3">
        {subs.map((sub, index) => (
          <motion.div
            key={sub.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
          >
            <Card className={cn(
              "p-4 border-l-[3px] border-l-amber-500",
              "dark:bg-card/60 bg-card backdrop-blur-sm",
              "dark:shadow-none shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
            )}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Crown className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[13px] font-bold text-foreground truncate">
                      {sub.plano?.nome || "Plano"}
                    </span>
                    <Badge className="dark:bg-amber-500/10 dark:text-amber-400 bg-amber-50 text-amber-700 ring-1 ring-amber-200/60 text-[9px] font-bold uppercase tracking-wider">
                      Aguardando
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 text-[12px] text-muted-foreground mb-1">
                    <User className="w-3 h-3" />
                    <span>{sub.profile?.nome || "Cliente"}</span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground/70">
                    <span className="font-bold tabular-nums text-foreground">
                      R$ {sub.plano?.preco_mensal?.toFixed(2).replace('.', ',') || "0,00"}
                    </span>
                    <span>•</span>
                    <span>{format(new Date(sub.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                  </div>
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-primary-foreground h-8 px-3 text-xs"
                    onClick={() => handleConfirm(sub)}
                    disabled={processing === sub.id}
                  >
                    {processing === sub.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="w-3.5 h-3.5 mr-1" />
                        Ativar
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-8 px-3 text-xs"
                    onClick={() => handleReject(sub)}
                    disabled={processing === sub.id}
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1" />
                    Recusar
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
