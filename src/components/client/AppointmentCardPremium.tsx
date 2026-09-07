import { useState } from "react";
import { Calendar, Clock, Check, AlertCircle, X, Gift, Scissors, Store, Star } from "lucide-react";
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
  barbeiro?: { apelido: string; tenant?: { nome: string } | null } | null;
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
        color: "#d97706",
        bgColor: "rgba(245, 158, 11, 0.1)",
        borderColor: "rgba(245, 158, 11, 0.2)",
        icon: Clock,
      };
    }
    
    switch (status) {
      case "confirmed":
        return { 
          label: "Confirmado", 
          color: "#059669",
          bgColor: "rgba(16, 185, 129, 0.1)",
          borderColor: "rgba(16, 185, 129, 0.2)",
          icon: Check,
        };
      case "completed":
        return { 
          label: "Concluído", 
          color: "#16a34a",
          bgColor: "rgba(22, 163, 74, 0.1)",
          borderColor: "rgba(22, 163, 74, 0.2)",
          icon: Check,
        };
      case "cancelled_by_admin":
        return { 
          label: "Cancelado", 
          color: "#dc2626",
          bgColor: "rgba(220, 38, 38, 0.08)",
          borderColor: "rgba(220, 38, 38, 0.18)",
          icon: X,
        };
      case "cancelled_by_user":
        return { 
          label: "Cancelado", 
          color: "#dc2626",
          bgColor: "rgba(220, 38, 38, 0.08)",
          borderColor: "rgba(220, 38, 38, 0.18)",
          icon: X,
        };
      case "no_show":
        return {
          label: "Faltou",
          color: "#737373",
          bgColor: "rgba(115, 115, 115, 0.1)",
          borderColor: "rgba(115, 115, 115, 0.2)",
          icon: AlertCircle,
        };
      default:
        return { 
          label: status, 
          color: "#737373",
          bgColor: "rgba(115, 115, 115, 0.1)",
          borderColor: "rgba(115, 115, 115, 0.2)",
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
  const hasActionSection = (rescheduleRequested && !isCancelled) || (canCancel && !rescheduleRequested);

  const externalPayment = payments.find(p => p.agendamento_id === appointment.id);
  const inlinePayment = appointment.pagamentos?.find(p => p.status === "paid");
  const isPaid = externalPayment?.status === "paid" || !!inlinePayment;
  const amount = appointment.preco || 0;

  const isPlanAppointment = appointment.tipo_agendamento === 'plano' || appointment.payment_method === 'plano';
  const isFreeAppointment = appointment.is_free && (
    appointment.payment_method === 'resgate' || 
    appointment.observacoes?.toLowerCase().includes('corte grátis') ||
    appointment.observacoes?.toLowerCase().includes('resgate')
  );

  const shopName = appointment.barbeiro?.tenant?.nome || "Barbearia DUB";
  const appointmentDate = new Date(`${appointment.data}T12:00:00`);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05, duration: 0.25 }}
        className="relative mb-3 rounded-[24px] overflow-hidden bg-white border border-neutral-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.05)] active:scale-[0.98] transition-transform"
      >
        <div className="p-5">
          {/* Top row: Status Badge + Date/Time */}
          <div className="flex items-center justify-between mb-3">
            <div
              className="inline-flex items-center gap-1.5 text-[11px] font-medium tracking-tight"
              style={{ color: statusConfig.color }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: statusConfig.color }}
              />
              {statusConfig.label}
            </div>

            <div className="flex items-center gap-1.5 text-neutral-400">
              <Calendar className="w-3.5 h-3.5" />
              <span className="text-[12px] font-medium tracking-tight text-neutral-600">
                {format(appointmentDate, "dd MMM", { locale: ptBR })}
              </span>
              <span>•</span>
              <Clock className="w-3.5 h-3.5 text-neutral-400 ml-0.5" />
              <span className="text-[12px] font-medium tracking-tight text-neutral-700">
                {appointment.hora}
              </span>
            </div>
          </div>

          {/* Center row: Service Name + Price */}
          <div className="mb-2">
            <h3 className="font-medium text-neutral-900 text-[16px] leading-snug tracking-tight mb-1">
              {appointment.servico?.nome || "Serviço"}
            </h3>

            <div className="flex items-center gap-2">
              {isPlanAppointment ? (
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-neutral-900 shadow-sm text-white">
                  <Star className="w-3 h-3 text-white fill-white" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider">Plano</span>
                </div>
              ) : isFreeAppointment ? (
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600">
                  <Gift className="w-3 h-3" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider">Grátis</span>
                </div>
              ) : appointment.preco ? (
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-neutral-600 tabular-nums">
                    R$ {appointment.preco.toFixed(2).replace('.', ',')}
                  </span>
                  {isPaid && (
                    <span className="text-[9px] text-emerald-600 font-semibold uppercase tracking-wider bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                      Pago
                    </span>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {/* Shop + Barber text (apenas texto por escrito, minimalista) */}
          <p className="text-[12px] text-neutral-400 font-normal">
            <span>{shopName}</span>
            {appointment.barbeiro?.apelido && (
              <span> • {appointment.barbeiro.apelido}</span>
            )}
          </p>
        </div>

        {/* Action sections */}
        {hasActionSection && (
          <div className="px-4 pb-4">
            {/* Reschedule banner */}
            {rescheduleRequested && !isCancelled && (
              <div className="mt-1 p-3 rounded-2xl bg-red-50/50 border border-red-100">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-[11px] font-semibold text-red-600 mb-0.5">
                      Remarcação Solicitada
                    </p>
                    {appointment.motivo_remarcacao && (
                      <p className="text-[10px] text-neutral-500">
                        {appointment.motivo_remarcacao}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  onClick={() => setRescheduleModalOpen(true)}
                  size="sm"
                  className="w-full mt-2.5 h-9 text-[11px] rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 font-medium"
                >
                  <Calendar className="w-3 h-3 mr-1.5" />
                  Remarcar
                </Button>
              </div>
            )}

            {/* Actions */}
            {canCancel && !rescheduleRequested && (
              <div className="flex gap-2 pt-1">
                <Button
                  onClick={() => setRescheduleModalOpen(true)}
                  size="sm"
                  variant="outline"
                  className="flex-1 h-9 text-[11px] font-medium rounded-xl border-neutral-200 bg-white/70 hover:bg-white text-neutral-700 shadow-none"
                >
                  Remarcar
                </Button>
                <Button
                  onClick={() => setCancelModalOpen(true)}
                  size="sm"
                  variant="outline"
                  className="flex-1 h-9 text-[11px] font-medium rounded-xl border-red-200/60 bg-red-50/40 hover:bg-red-50 text-red-600 hover:text-red-700 shadow-none transition-colors"
                >
                  Cancelar
                </Button>
              </div>
            )}
          </div>
        )}
      </motion.div>

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
