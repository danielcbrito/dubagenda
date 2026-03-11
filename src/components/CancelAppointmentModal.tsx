import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useCancelAppointment } from "@/hooks/useClientMutations";

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
  /** Optional metadata for webhook enrichment */
  appointmentMeta?: {
    servico?: string;
    data?: string;
    hora?: string;
    preco?: number;
    barbeiro_id?: string;
  };
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
  appointmentMeta,
}: CancelAppointmentModalProps) {
  const { cancelAppointment, cancelling } = useCancelAppointment();

  // Detect credit-based payment
  const isPaidWithCredit = paymentMethod === 'credit' || 
    observacoes?.toLowerCase().includes('crédito do app') ||
    observacoes?.toLowerCase().includes('credito do app');

  // Extract credit amount from observacoes if needed
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
  const refundAmount = shouldRefundCredit ? creditAmount : (shouldRefundPayment ? amount : 0);

  const handleCancelDefinitely = () => {
    cancelAppointment({
      appointmentId,
      appointmentMeta: appointmentMeta || { preco: amount },
      onSuccess: () => {
        onSuccess();
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[360px] rounded-2xl border-border/60 bg-background p-0 overflow-hidden shadow-2xl [&>button]:w-8 [&>button]:h-8 [&>button]:top-4 [&>button]:right-4">
        {/* Header */}
        <div className="flex flex-col items-center pt-8 pb-3 px-6">
          <DialogHeader className="text-center space-y-2">
            <DialogTitle className="text-[19px] font-bold text-foreground tracking-tight">
              Cancelar Agendamento
            </DialogTitle>
            <DialogDescription className="text-[14px] text-muted-foreground leading-relaxed max-w-[280px] mx-auto">
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

          <Button
            onClick={handleCancelDefinitely}
            disabled={cancelling}
            className="w-full h-[50px] rounded-xl text-[15px] font-semibold"
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
      </DialogContent>
    </Dialog>
  );
}
