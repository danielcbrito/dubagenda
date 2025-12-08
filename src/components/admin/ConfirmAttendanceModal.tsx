import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle, User, CreditCard } from "lucide-react";
import { TimelineAppointment } from "./AdminAgenda";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
            </div>
            <span>Confirmação Obrigatória</span>
          </DialogTitle>
          <DialogDescription>
            Confirme a realização do atendimento e o pagamento do cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Cliente Info */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/[0.05] flex items-center justify-center">
                <User className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{appointment.profile?.nome || "Cliente"}</p>
                <p className="text-sm text-muted-foreground">
                  {appointment.servico?.nome} - <span className="text-primary font-medium">R$ {appointment.preco.toFixed(2)}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Payment Info */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/[0.05] flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">Forma de Pagamento</p>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "font-medium",
                    isPrepaid 
                      ? "bg-green-500/20 text-green-400 border-green-500/30" 
                      : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                  )}
                >
                  {paymentMethod === 'pix' && 'PIX'}
                  {paymentMethod === 'card' && 'Cartão'}
                  {paymentMethod === 'cash' && 'Pagar na Barbearia'}
                  {isPrepaid ? ' - Pago' : ' - Pendente'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Perguntas */}
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <p className="font-medium text-sm text-blue-300">O cliente compareceu ao atendimento?</p>
            <p className="font-medium text-sm text-blue-300 mt-1">O pagamento foi realizado corretamente?</p>
          </div>

          {/* Aviso de Segurança */}
          {!isPrepaid && (
            <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-sm text-yellow-400">
                Atenção: Cliente ainda não efetuou o pagamento. Confirme apenas após receber o pagamento na barbearia.
              </p>
            </div>
          )}

          {/* Explicação do Sistema de Pontos */}
          <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
            <p className="text-sm text-green-400">
              Ao confirmar, o cliente receberá <strong>1 ponto de fidelidade</strong>. 
              Após 5 pontos, será creditado automaticamente 1 corte gratuito.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            onClick={handleConfirmAttendance}
            disabled={loading}
            className="flex-1 h-12 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl transition-all duration-200 hover:scale-[1.02]"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Confirmar Atendimento
          </Button>
          <Button
            onClick={handleNoShow}
            disabled={loading}
            variant="destructive"
            className="flex-1 h-12 rounded-xl font-semibold transition-all duration-200 hover:scale-[1.02]"
          >
            <XCircle className="w-4 h-4 mr-2" />
            Não Compareceu
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
