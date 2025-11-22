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
}

export function CancelAppointmentModal({
  open,
  onOpenChange,
  appointmentId,
  isPaid,
  amount,
  userId,
  onSuccess,
}: CancelAppointmentModalProps) {
  const [cancelling, setCancelling] = useState(false);

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

      // If paid, create credit for user
      if (isPaid) {
        const { error: creditError } = await supabase
          .from("creditos")
          .insert({
            user_id: userId,
            valor: amount,
            origem: "cancelamento",
            agendamento_origem_id: appointmentId,
          });

        if (creditError) throw creditError;
        
        toast.success("Agendamento cancelado. Crédito de R$ " + amount.toFixed(2) + " disponível para o próximo corte.");
      } else {
        toast.success("Agendamento cancelado com sucesso.");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error cancelling appointment:", error);
      toast.error("Erro ao cancelar agendamento");
    } finally {
      setCancelling(false);
    }
  };

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
          {isPaid && (
            <div className="p-3 bg-primary/10 rounded-md text-sm">
              💡 O valor já pago de <strong>R$ {amount.toFixed(2)}</strong> ficará disponível como crédito para o próximo corte.
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
