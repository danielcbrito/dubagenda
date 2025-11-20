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
import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();

  const handleReschedule = async () => {
    setCancelling(true);
    try {
      // Cancel current appointment
      const { error: updateError } = await supabase
        .from("agendamentos")
        .update({ 
          status: "cancelled_by_user",
          visivel_para_usuario: false,
          cancelado_em: new Date().toISOString()
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
        
        toast.success("Agendamento cancelado. Crédito disponível para uso.");
      } else {
        toast.success("Agendamento cancelado.");
      }

      onSuccess();
      onOpenChange(false);
      
      // Navigate to scheduling page
      navigate("/cliente/agendar");
    } catch (error) {
      console.error("Error rescheduling appointment:", error);
      toast.error("Erro ao remarcar agendamento");
    } finally {
      setCancelling(false);
    }
  };

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
            Escolha uma das opções abaixo:
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3">
          <Button
            onClick={handleReschedule}
            className="w-full"
            variant="outline"
          >
            Remarcar
          </Button>
          
          <Button
            onClick={handleCancelDefinitely}
            disabled={cancelling}
            className="w-full"
            variant="destructive"
          >
            {cancelling ? "Cancelando..." : "Cancelar Definitivamente"}
          </Button>
          
          {isPaid && (
            <div className="mt-4 p-3 bg-muted rounded-md text-sm text-muted-foreground">
              💡 O valor já pago ficará disponível como crédito para o próximo corte.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
