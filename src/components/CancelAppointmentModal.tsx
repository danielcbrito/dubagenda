import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";

interface CancelAppointmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
  isPaid: boolean;
  amount: number;
  userId: string;
  onSuccess: () => void;
  paymentMethod?: string;
  observacoes?: string;
}

export function CancelAppointmentModal({
  open,
  onOpenChange,
  appointmentId,
  isPaid,
  amount,
  userId,
  onSuccess,
  paymentMethod,
  observacoes,
}: CancelAppointmentModalProps) {
  const [cancelling, setCancelling] = useState(false);

  // Detecta se foi pago com crédito do app
  const isPaidWithCredit = paymentMethod === 'credit' || 
    observacoes?.toLowerCase().includes('crédito do app') ||
    observacoes?.toLowerCase().includes('credito do app');

  // Detecta se foi pago via gateway (cartão ou PIX)
  const isPaidViaGateway = isPaid && !isPaidWithCredit && 
    (paymentMethod === 'pix' || paymentMethod === 'card' || paymentMethod === 'credit_card');

  // Extrai valor do crédito das observações se necessário
  const getCreditAmount = (): number => {
    if (amount > 0) return amount;
    
    if (observacoes) {
      const match = observacoes.match(/R\$\s*([\d.,]+)/);
      if (match) {
        return parseFloat(match[1].replace(',', '.'));
      }
    }
    return 0;
  };

  const creditAmount = getCreditAmount();
  const shouldRefundCredit = isPaidWithCredit && creditAmount > 0;
  const shouldRefundPayment = isPaid && !isPaidWithCredit && amount > 0;

  /** Credita o valor diretamente no saldo da carteira (wallet_balances) */
  async function creditToWallet(uid: string, valor: number, agendamentoId: string, description: string) {
    try {
      // 1. Garantir que o wallet_balance existe e pegar saldo atual
      const { data: currentBalance } = await supabase
        .rpc("get_or_create_wallet_balance", { p_user_id: uid });

      // 2. Atualizar saldo
      const newBalance = (currentBalance || 0) + valor;
      const { error: updateError } = await supabase
        .from("wallet_balances")
        .update({ balance: newBalance })
        .eq("user_id", uid);

      if (updateError) throw updateError;

      // 3. Registrar transação no histórico
      await supabase.from("wallet_transactions").insert({
        user_id: uid,
        type: "refund",
        amount: valor,
        status: "completed",
        description,
      });

      return true;
    } catch (err) {
      console.error("Erro ao creditar carteira:", err);
      return false;
    }
  }

  const handleCancelDefinitely = async () => {
    setCancelling(true);
    try {
      // 1. Cancelar o agendamento
      const { error: updateError } = await supabase
        .from("agendamentos")
        .update({ 
          status: "cancelled_by_user",
          visivel_para_usuario: false 
        })
        .eq("id", appointmentId);

      if (updateError) throw updateError;

      // 2. Estorno de crédito do app → vai direto para saldo da carteira
      if (shouldRefundCredit) {
        const ok = await creditToWallet(
          userId, creditAmount, appointmentId,
          `Estorno de cancelamento - R$ ${creditAmount.toFixed(2)}`
        );
        
        if (!ok) throw new Error("Erro ao creditar carteira");
        toast.success(`Agendamento cancelado. R$ ${creditAmount.toFixed(2)} adicionado ao saldo da sua carteira.`);
      } 
      // 3. Estorno de pagamento gateway (PIX/Cartão) → direto para saldo da carteira
      else if (shouldRefundPayment && isPaidViaGateway) {
        const ok = await creditToWallet(
          userId, amount, appointmentId,
          `Estorno de cancelamento (${paymentMethod === 'pix' ? 'PIX' : 'Cartão'}) - R$ ${amount.toFixed(2)}`
        );
        
        if (!ok) throw new Error("Erro ao creditar carteira");
        toast.success(`Agendamento cancelado. R$ ${amount.toFixed(2)} adicionado ao saldo da sua carteira.`);
      }
      // 4. Pagamento normal sem gateway → direto para saldo da carteira
      else if (shouldRefundPayment) {
        const ok = await creditToWallet(
          userId, amount, appointmentId,
          `Estorno de cancelamento - R$ ${amount.toFixed(2)}`
        );
        
        if (!ok) throw new Error("Erro ao creditar carteira");
        toast.success(`Agendamento cancelado. R$ ${amount.toFixed(2)} adicionado ao saldo da sua carteira.`);
      } else {
        toast.success("Agendamento cancelado com sucesso.");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error cancelling appointment:", error);
      toast.error("Erro ao cancelar agendamento. Tente novamente.");
    } finally {
      setCancelling(false);
    }
  };

  const refundAmount = shouldRefundCredit ? creditAmount : (shouldRefundPayment ? amount : 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[360px] rounded-2xl border-border/60 bg-background p-0 overflow-hidden shadow-2xl">
        {/* Header visual */}
        <div className="flex flex-col items-center pt-7 pb-4 px-6">
          <div className="w-[52px] h-[52px] rounded-full border-2 border-destructive/30 bg-destructive/5 flex items-center justify-center mb-4">
            <X className="w-6 h-6 text-destructive" strokeWidth={2.5} />
          </div>
          <DialogHeader className="text-center space-y-1.5">
            <DialogTitle className="text-[17px] font-bold text-foreground tracking-tight">
              Cancelar Agendamento
            </DialogTitle>
            <DialogDescription className="text-[13px] text-muted-foreground leading-relaxed max-w-[260px] mx-auto">
              Tem certeza que deseja cancelar este agendamento definitivamente?
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {refundAmount > 0 && (
            <div className="p-3.5 bg-emerald-500/10 dark:bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[13px] text-emerald-700 dark:text-emerald-400 leading-relaxed text-center">
              💰 <strong>R$ {refundAmount.toFixed(2)}</strong> será adicionado ao saldo da sua carteira.
            </div>
          )}

          <div className="flex gap-3">
            <Button
              onClick={() => onOpenChange(false)}
              variant="outline"
              className="flex-1 h-12 rounded-xl text-[14px] font-semibold border-border"
              disabled={cancelling}
            >
              Voltar
            </Button>

            <Button
              onClick={handleCancelDefinitely}
              disabled={cancelling}
              className="flex-1 h-12 rounded-xl text-[14px] font-semibold"
              variant="destructive"
            >
              {cancelling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                "Confirmar Cancelamento"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
