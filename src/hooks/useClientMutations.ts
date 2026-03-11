import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sendAgendamentoCanceladoEvent } from "@/lib/webhookService";

interface CancelAppointmentParams {
  appointmentId: string;
  /** Used for webhook fire-and-forget (service name, date, time, etc.) */
  appointmentMeta?: {
    servico?: string;
    data?: string;
    hora?: string;
    preco?: number;
    barbeiro_id?: string;
  };
  onSuccess?: () => void;
  onOptimisticRemove?: (appointmentId: string) => void;
}

export function useCancelAppointment() {
  const [cancelling, setCancelling] = useState(false);

  const cancelAppointment = useCallback(async ({
    appointmentId,
    appointmentMeta,
    onSuccess,
    onOptimisticRemove,
  }: CancelAppointmentParams) => {
    setCancelling(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-appointment-client", {
        body: { appointmentId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Optimistic: remove from local state immediately
      onOptimisticRemove?.(appointmentId);

      const refunded = data?.refundedAmount || 0;
      if (refunded > 0) {
        toast.success(`Agendamento cancelado. R$ ${refunded.toFixed(2)} adicionado ao saldo da sua carteira.`);
      } else {
        toast.success("Agendamento cancelado com sucesso.");
      }

      onSuccess?.();

      // Fire-and-forget: send webhook event
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        sendAgendamentoCanceladoEvent({
          agendamento_id: appointmentId,
          cliente_id: user.id,
          cliente_nome: user.user_metadata?.nome || user.email || "Cliente",
          servico: appointmentMeta?.servico,
          data: appointmentMeta?.data,
          hora: appointmentMeta?.hora,
          preco: appointmentMeta?.preco,
          cancelado_por: "cliente",
        }).catch(() => {/* silent */});
      }
    } catch (err: any) {
      console.error("Cancel appointment error:", err);
      toast.error("Erro ao cancelar agendamento. Tente novamente.");
    } finally {
      setCancelling(false);
    }
  }, []);

  return { cancelAppointment, cancelling };
}
