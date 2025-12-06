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

  // Extrai valor do crédito das observações se necessário
  const getCreditAmount = (): number => {
    if (amount > 0) return amount;
    
    // Tenta extrair de observações: "Pago com crédito do app: R$ 25.00"
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

  const handleCancelDefinitely = async () => {
    setCancelling(true);
    try {
      // Update appointment status
      const { error: updateError } = await supabase
        .from("agendamentos")
        .update({ 
          status: "cancelled_by_user",
          visivel_para_usuario: false 
        })
        .eq("id", appointmentId);

      if (updateError) throw updateError;

      // Estorno de crédito: cria novo crédito disponível para o usuário
      if (shouldRefundCredit) {
        const { error: creditError } = await supabase
          .from("creditos")
          .insert({
            user_id: userId,
            valor: creditAmount,
            origem: "estorno_cancelamento",
            agendamento_origem_id: appointmentId,
            usado: false,
          });

        if (creditError) {
          console.error("Erro ao estornar crédito:", creditError);
          throw creditError;
        }
        
        toast.success(`Agendamento cancelado. R$ ${creditAmount.toFixed(2)} estornado para sua carteira.`);
      } 
      // Estorno de pagamento normal (PIX, cartão, etc)
      else if (shouldRefundPayment) {
        const { error: creditError } = await supabase
          .from("creditos")
          .insert({
            user_id: userId,
            valor: amount,
            origem: "cancelamento",
            agendamento_origem_id: appointmentId,
            usado: false,
          });

        if (creditError) throw creditError;
        
        toast.success(`Agendamento cancelado. Crédito de R$ ${amount.toFixed(2)} disponível para o próximo corte.`);
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancelar Agendamento</DialogTitle>
          <DialogDescription>
            Tem certeza que deseja cancelar este agendamento definitivamente?
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3">
          {refundAmount > 0 && (
            <div className="p-3 bg-primary/10 rounded-md text-sm">
              {shouldRefundCredit ? (
                <>
                  💰 O valor de <strong>R$ {creditAmount.toFixed(2)}</strong> usado do crédito será <strong>estornado</strong> para sua carteira.
                </>
              ) : (
                <>
                  💡 O valor já pago de <strong>R$ {amount.toFixed(2)}</strong> ficará disponível como crédito para o próximo corte.
                </>
              )}
            </div>
          )}
          
          <div className="flex gap-3">
            <Button
              onClick={() => onOpenChange(false)}
              variant="outline"
              className="flex-1"
            >
              Voltar
            </Button>
            
            <Button
              onClick={handleCancelDefinitely}
              disabled={cancelling}
              className="flex-1"
              variant="destructive"
            >
              {cancelling ? "Cancelando..." : "Confirmar Cancelamento"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
