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
import { Loader2 } from "lucide-react";

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

      // 2. Estorno de crédito do app
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
      // 3. Estorno automático via Asaas (PIX/Cartão)
      else if (shouldRefundPayment && isPaidViaGateway) {
        try {
          const { data: refundResult, error: refundError } = await supabase.functions.invoke(
            'refund-payment',
            { body: { agendamento_id: appointmentId } }
          );

          if (refundError) {
            console.error("Erro ao chamar refund-payment:", refundError);
            // Fallback: criar crédito interno
            await createInternalCredit(userId, amount, appointmentId);
            toast.success(`Agendamento cancelado. R$ ${amount.toFixed(2)} disponível como crédito.`);
          } else if (refundResult?.refunded) {
            if (refundResult.refund_type === 'gateway') {
              toast.success(`Agendamento cancelado. Estorno de R$ ${amount.toFixed(2)} realizado para sua conta.`);
            } else {
              toast.success(`Agendamento cancelado. R$ ${amount.toFixed(2)} disponível como crédito.`);
            }
          } else {
            toast.success("Agendamento cancelado com sucesso.");
          }
        } catch (refundErr) {
          console.error("Erro no estorno:", refundErr);
          // Fallback: criar crédito interno
          await createInternalCredit(userId, amount, appointmentId);
          toast.success(`Agendamento cancelado. R$ ${amount.toFixed(2)} disponível como crédito.`);
        }
      }
      // 4. Pagamento normal sem gateway (fallback crédito)
      else if (shouldRefundPayment) {
        await createInternalCredit(userId, amount, appointmentId);
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

  /** Cria crédito interno como fallback */
  async function createInternalCredit(userId: string, valor: number, agendamentoId: string) {
    const { error } = await supabase.from("creditos").insert({
      user_id: userId,
      valor,
      origem: "cancelamento",
      agendamento_origem_id: agendamentoId,
      usado: false,
    });
    if (error) console.error("Erro ao criar crédito interno:", error);
  }

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
              ) : isPaidViaGateway ? (
                <>
                  💰 O valor de <strong>R$ {amount.toFixed(2)}</strong> será <strong>estornado automaticamente</strong> para sua conta.
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
              disabled={cancelling}
            >
              Voltar
            </Button>
            
            <Button
              onClick={handleCancelDefinitely}
              disabled={cancelling}
              className="flex-1"
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
