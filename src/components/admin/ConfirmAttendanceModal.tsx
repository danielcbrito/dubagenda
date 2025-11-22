import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle, User, CreditCard } from "lucide-react";
import { TimelineAppointment } from "./AdminAgenda";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ConfirmAttendanceModalProps {
  appointment: TimelineAppointment | null;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export function ConfirmAttendanceModal({ appointment, open, onClose, onUpdate }: ConfirmAttendanceModalProps) {
  const [loading, setLoading] = useState(false);

  if (!appointment) return null;

  const payment = appointment.pagamentos?.[0];
  const paymentMethod = payment?.metodo || appointment.payment_method || 'cash';
  const isPrepaid = payment?.status === 'paid';

  const handleConfirmAttendance = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("agendamentos")
        .update({ 
          status: 'completed' as any,
          barbeiro_confirmou: true,
          cliente_confirmou: true
        } as any)
        .eq("id", appointment.id);

      if (error) throw error;

      toast.success("Atendimento confirmado com sucesso. Ponto de fidelidade liberado.");
      onUpdate();
      onClose();
    } catch (error) {
      console.error("Error confirming attendance:", error);
      toast.error("Erro ao confirmar atendimento");
    } finally {
      setLoading(false);
    }
  };

  const handleNoShow = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("agendamentos")
        .update({ 
          status: 'no_show' as any,
          barbeiro_confirmou: false,
          ponto_liberado: false
        } as any)
        .eq("id", appointment.id);

      if (error) throw error;

      toast.info("Cliente marcado como ausente");
      onUpdate();
      onClose();
    } catch (error) {
      console.error("Error marking no-show:", error);
      toast.error("Erro ao marcar ausência");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <AlertTriangle className="w-6 h-6 text-yellow-500" />
            Confirmação Obrigatória
          </DialogTitle>
          <DialogDescription className="text-base">
            Confirme a realização do atendimento e o pagamento do cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Cliente Info */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold">{appointment.profile?.nome || "Cliente"}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {appointment.servico?.nome} - R$ {appointment.preco.toFixed(2)}
            </div>
          </div>

          {/* Payment Info */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Forma de Pagamento</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isPrepaid ? "default" : "outline"} className={isPrepaid ? "bg-green-500" : ""}>
                {paymentMethod === 'pix' && 'PIX'}
                {paymentMethod === 'card' && 'Cartão'}
                {paymentMethod === 'cash' && 'Pagar na Barbearia'}
                {isPrepaid ? ' - Pago' : ' - Pendente'}
              </Badge>
            </div>
          </div>

          {/* Perguntas */}
          <div className="space-y-2 bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg">
            <p className="font-medium text-sm">O cliente compareceu ao atendimento?</p>
            <p className="font-medium text-sm">O pagamento foi realizado corretamente?</p>
          </div>

          {/* Aviso de Segurança */}
          {!isPrepaid && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-lg">
              <p className="text-xs text-yellow-700 dark:text-yellow-400">
                Atenção: Cliente ainda não efetuou o pagamento. Confirme apenas após receber o pagamento na barbearia.
              </p>
            </div>
          )}

          {/* Explicação do Sistema de Pontos */}
          <div className="bg-green-500/10 border border-green-500/20 p-3 rounded-lg">
            <p className="text-xs text-green-700 dark:text-green-400">
              Ao confirmar, o cliente receberá <strong>1 ponto de fidelidade</strong>. 
              Após 5 pontos, será creditado automaticamente 1 corte gratuito.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            onClick={handleConfirmAttendance}
            disabled={loading}
            className="flex-1"
            size="lg"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Confirmar Atendimento
          </Button>
          <Button
            onClick={handleNoShow}
            disabled={loading}
            variant="destructive"
            className="flex-1"
            size="lg"
          >
            <XCircle className="w-4 h-4 mr-2" />
            Não Compareceu
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
