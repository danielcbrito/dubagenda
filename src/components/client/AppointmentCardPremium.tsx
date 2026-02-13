import { useState } from "react";
import { Calendar, Clock, Check, AlertCircle, ChevronRight, X, Crown, Gift, Scissors } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { RescheduleAppointmentModal } from "@/components/RescheduleAppointmentModal";
import { CancelAppointmentModal } from "@/components/CancelAppointmentModal";

interface Appointment {
  id: string;
  data: string;
  hora: string;
  servico: { nome: string };
  status: string;
  duracao?: number;
  preco?: number;
  observacoes?: string;
  cliente_confirmou?: boolean;
  barbeiro_confirmou?: boolean;
  ponto_liberado?: boolean;
  cancelado_em?: string;
  visivel_para_usuario?: boolean;
  remarcacao_solicitada?: boolean;
  motivo_remarcacao?: string;
  payment_method?: string | null;
  tipo_agendamento?: string | null;
  is_free?: boolean | null;
  barbeiro?: { apelido: string } | null;
  pagamentos?: Array<{
    metodo: string;
    status: string;
  }>;
}

interface AppointmentCardPremiumProps {
  appointment: Appointment;
  onCancel?: () => void;
  onConfirm?: (id: string) => void;
  userId?: string;
  payments?: any[];
  index?: number;
}

export function AppointmentCardPremium({ 
  appointment, 
  onCancel, 
  onConfirm,
  userId,
  payments = [],
  index = 0
}: AppointmentCardPremiumProps) {
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  const getStatusConfig = (status: string, barbeiroConfirmou: boolean | undefined) => {
    if (status === "pending" && !barbeiroConfirmou) {
      return { 
        label: "Aguardando", 
        color: "#F59E0B",
        bgColor: "rgba(245, 158, 11, 0.1)",
        borderColor: "rgba(245, 158, 11, 0.3)",
        icon: Clock,
      };
    }
    
    switch (status) {
      case "confirmed":
        return { 
          label: "Confirmado", 
          color: "#10B981",
          bgColor: "rgba(16, 185, 129, 0.1)",
          borderColor: "rgba(16, 185, 129, 0.3)",
          icon: Check,
        };
      case "completed":
        return { 
          label: "Concluído", 
          color: "#D1A854",
          bgColor: "rgba(209, 168, 84, 0.1)",
          borderColor: "rgba(209, 168, 84, 0.3)",
          icon: Check,
        };
      case "cancelled_by_user":
      case "cancelled_by_admin":
        return { 
          label: "Cancelado", 
          color: "#EF4444",
          bgColor: "rgba(239, 68, 68, 0.1)",
          borderColor: "rgba(239, 68, 68, 0.3)",
          icon: X,
        };
      default:
        return { 
          label: status, 
          color: "#6B7280",
          bgColor: "rgba(107, 114, 128, 0.1)",
          borderColor: "rgba(107, 114, 128, 0.3)",
          icon: Clock,
        };
    }
  };

  const statusConfig = getStatusConfig(appointment.status, appointment.barbeiro_confirmou);
  const StatusIcon = statusConfig.icon;
  const isCancelled = appointment.status === "cancelled_by_user" || appointment.status === "cancelled_by_admin";
  const isAwaitingBarberApproval = appointment.status === "pending" && !appointment.barbeiro_confirmou;
  const rescheduleRequested = appointment.remarcacao_solicitada === true;
  const canCancel = (appointment.status === "pending" || appointment.status === "confirmed") && !isAwaitingBarberApproval && !rescheduleRequested;
  const needsConfirmation = appointment.status === "completed" && !appointment.cliente_confirmou && onConfirm;

  const externalPayment = payments.find(p => p.agendamento_id === appointment.id);
  const inlinePayment = appointment.pagamentos?.find(p => p.status === "paid");
  const isPaid = externalPayment?.status === "paid" || !!inlinePayment;
  const amount = appointment.preco || 0;

  // Determinar se é agendamento de plano ou corte grátis
  const isPlanAppointment = appointment.tipo_agendamento === 'plano' || appointment.payment_method === 'plano';
  const isFreeAppointment = appointment.is_free && (
    appointment.payment_method === 'resgate' || 
    appointment.observacoes?.toLowerCase().includes('corte grátis') ||
    appointment.observacoes?.toLowerCase().includes('resgate')
  );

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1, duration: 0.3 }}
        className="rounded-2xl overflow-hidden"
        style={{
          background: "hsl(var(--card))",
          border: "1px solid hsl(var(--border))",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
        }}
      >
        <div className="p-4">
          {/* Header with status */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="font-bold text-foreground text-base mb-1">
                {appointment.servico?.nome || "Serviço"}
              </h3>
              {appointment.barbeiro?.apelido && (
                <div className="flex items-center gap-1.5 mb-1">
                  <Scissors className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-medium">
                    {appointment.barbeiro.apelido}
                  </span>
                </div>
              )}
              <div 
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{
                  background: statusConfig.bgColor,
                  color: statusConfig.color,
                  border: `1px solid ${statusConfig.borderColor}`,
                }}
              >
                <StatusIcon className="w-3 h-3" />
                {statusConfig.label}
              </div>
            </div>

            {/* Date badge */}
            <div 
              className="text-center px-3 py-2 rounded-xl"
              style={{
                background: "hsl(var(--secondary))",
              }}
            >
              <p className="text-[10px] text-muted-foreground uppercase font-medium">
                {format(new Date(`${appointment.data}T12:00:00`), "MMM", { locale: ptBR })}
              </p>
              <p className="text-lg font-bold text-foreground leading-none">
                {format(new Date(`${appointment.data}T12:00:00`), "dd", { locale: ptBR })}
              </p>
            </div>
          </div>

          {/* Details */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-primary/70" />
              <span className="font-medium">{appointment.hora}</span>
            </div>
            {isPlanAppointment ? (
              <div className="flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary">Plano</span>
              </div>
            ) : isFreeAppointment ? (
              <div className="flex items-center gap-1.5">
                <Gift className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-xs font-semibold text-emerald-500">Corte Grátis</span>
              </div>
            ) : appointment.preco ? (
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-foreground">
                  R$ {appointment.preco.toFixed(2)}
                </span>
                {isPaid && (
                  <span className="text-[10px] text-green-500 font-medium">Pago</span>
                )}
              </div>
            ) : null}
          </div>

          {/* Reschedule requested banner */}
          {rescheduleRequested && !isCancelled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mb-4 p-3 rounded-xl"
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
              }}
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-primary mb-1">
                    Remarcação Solicitada
                  </p>
                  {appointment.motivo_remarcacao && (
                    <p className="text-xs text-muted-foreground">
                      {appointment.motivo_remarcacao}
                    </p>
                  )}
                </div>
              </div>
              <Button
                onClick={() => setRescheduleModalOpen(true)}
                size="sm"
                className="w-full mt-3 h-9"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Remarcar Agora
              </Button>
            </motion.div>
          )}

          {/* Confirmation needed */}
          {needsConfirmation && (
            <Button 
              onClick={() => onConfirm?.(appointment.id)}
              size="sm"
              className="w-full mb-3 h-10"
            >
              <Check className="w-4 h-4 mr-2" />
              Confirmar Presença
            </Button>
          )}

          {/* Action buttons */}
          {canCancel && !rescheduleRequested && (
            <div className="flex gap-2">
              <Button 
                onClick={() => setRescheduleModalOpen(true)}
                size="sm"
                variant="outline"
                className="flex-1 h-10 rounded-xl"
              >
                Remarcar
              </Button>
              <Button 
                onClick={() => setCancelModalOpen(true)}
                size="sm"
                variant="outline"
                className="flex-1 h-10 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10"
              >
                Cancelar
              </Button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Modals */}
      <RescheduleAppointmentModal
        open={rescheduleModalOpen}
        onOpenChange={setRescheduleModalOpen}
        appointmentId={appointment.id}
        currentDate={appointment.data}
        currentTime={appointment.hora}
        serviceName={appointment.servico?.nome || "Serviço"}
      />

      <CancelAppointmentModal
        open={cancelModalOpen}
        onOpenChange={setCancelModalOpen}
        appointmentId={appointment.id}
        isPaid={isPaid}
        amount={amount}
        userId={userId || ""}
        paymentMethod={(appointment as any).payment_method}
        observacoes={appointment.observacoes}
        onSuccess={() => {
          setCancelModalOpen(false);
          onCancel?.();
        }}
      />
    </>
  );
}
