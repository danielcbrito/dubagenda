import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
    } catch (err: any) {
      console.error("Cancel appointment error:", err);
      toast.error("Erro ao cancelar agendamento. Tente novamente.");
    } finally {
      setCancelling(false);
    }
  }, []);

  return { cancelAppointment, cancelling };
}

// ─── Cancelar Reserva Pendente (pending_booking) ───

interface CancelPendingBookingParams {
  bookingId: string;
  asaasPaymentId?: string | null;
}

export function useCancelarReservaPendente() {
  const [cancelling, setCancelling] = useState(false);

  const cancelarReserva = useCallback(async ({
    bookingId,
    asaasPaymentId,
  }: CancelPendingBookingParams) => {
    setCancelling(true);
    try {
      if (asaasPaymentId) {
        // Cancela no Asaas + deleta pending_booking em uma única chamada
        const { data, error } = await supabase.functions.invoke("cleanup-pending-payments", {
          body: {
            action: "cancel",
            asaasPaymentId,
            pendingBookingId: bookingId,
            type: "booking",
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      } else {
        // Sem cobrança no gateway — apenas deleta localmente
        const { error } = await supabase
          .from("pending_bookings")
          .delete()
          .eq("id", bookingId);
        if (error) throw error;
      }

      toast.success("Reserva cancelada.");
    } catch (err: any) {
      console.error("Cancel pending booking error:", err);
      toast.error("Erro ao cancelar reserva. Tente novamente.");
    } finally {
      setCancelling(false);
    }
  }, []);

  return { cancelarReserva, cancelling };
}
