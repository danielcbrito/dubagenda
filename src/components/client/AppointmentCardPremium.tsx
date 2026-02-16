import { useState } from "react";
import { Calendar, Clock, Check, AlertCircle, X, Crown, Gift, Scissors } from "lucide-react";
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
        color: "hsl(38 92% 50%)",
        bgColor: "hsl(38 92% 50% / 0.08)",
        borderColor: "hsl(38 92% 50% / 0.15)",
        icon: Clock,
      };
    }
    
    switch (status) {
      case "confirmed":
        return { 
          label: "Confirmado", 
          color: "hsl(160 60% 45%)",
          bgColor: "hsl(160 60% 45% / 0.08)",
          borderColor: "hsl(160 60% 45% / 0.15)",
          icon: Check,
        };
      case "completed":
        return { 
          label: "Concluído", 
          color: "hsl(var(--gold))",
          bgColor: "hsl(var(--gold) / 0.08)",
          borderColor: "hsl(var(--gold) / 0.15)",
          icon: Check,
        };
      case "cancelled_by_user":
      case "cancelled_by_admin":
        return { 
          label: "Cancelado", 
          color: "hsl(var(--destructive))",
          bgColor: "hsl(var(--destructive) / 0.06)",
          borderColor: "hsl(var(--destructive) / 0.12)",
          icon: X,
        };
      default:
        return { 
          label: status, 
          color: "hsl(var(--muted-foreground))",
          bgColor: "hsl(var(--muted) / 0.08)",
          borderColor: "hsl(var(--border) / 0.3)",
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

  const isPlanAppointment = appointment.tipo_agendamento === 'plano' || appointment.payment_method === 'plano';
  const isFreeAppointment = appointment.is_free && (
    appointment.payment_method === 'resgate' || 
    appointment.observacoes?.toLowerCase().includes('corte grátis') ||
    appointment.observacoes?.toLowerCase().includes('resgate')
  );

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.06, duration: 0.25 }}
        className="rounded-xl overflow-hidden border border-border bg-card active:scale-[0.99] transition-transform"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-2.5">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground text-[13px] mb-1 truncate">
                {appointment.servico?.nome || "Serviço"}
              </h3>
              <div 
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-semibold uppercase tracking-wider"
                style={{
                  background: statusConfig.bgColor,
                  color: statusConfig.color,
                  border: `1px solid ${statusConfig.borderColor}`,
                }}
              >
                <StatusIcon className="w-2.5 h-2.5" />
                {statusConfig.label}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {appointment.barbeiro?.apelido && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/60">
                  <Scissors className="w-2.5 h-2.5 text-muted-foreground/60" />
                  <span className="text-[10px] text-foreground/70 font-medium">
                    {appointment.barbeiro.apelido}
                  </span>
                </div>
              )}
              <div className="text-center px-2.5 py-1.5 rounded-lg bg-muted/60">
                <p className="text-[8px] text-muted-foreground uppercase font-semibold tracking-wider">
                  {format(new Date(`${appointment.data}T12:00:00`), "MMM", { locale: ptBR })}
                </p>
                <p className="text-sm font-bold text-foreground leading-none tabular-nums">
                  {format(new Date(`${appointment.data}T12:00:00`), "dd", { locale: ptBR })}
                </p>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-3">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-muted-foreground/60" />
              <span className="font-medium tabular-nums">{appointment.hora}</span>
            </div>
            {isPlanAppointment ? (
              <div className="flex items-center gap-1">
                <Crown className="w-3 h-3 text-primary/60" />
                <span className="text-[10px] font-semibold text-primary/60">Plano</span>
              </div>
            ) : isFreeAppointment ? (
              <div className="flex items-center gap-1">
                <Gift className="w-3 h-3 text-emerald-500/60" />
                <span className="text-[10px] font-semibold text-emerald-500/60">Grátis</span>
              </div>
            ) : appointment.preco ? (
              <div className="flex items-center gap-1">
                <span className="font-semibold text-foreground tabular-nums">
                  R$ {appointment.preco.toFixed(2)}
                </span>
                {isPaid && (
                  <span className="text-[8px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider">Pago</span>
                )}
              </div>
            ) : null}
          </div>

          {/* Reschedule banner */}
          {rescheduleRequested && !isCancelled && (
            <div className="mb-3 p-2.5 rounded-lg bg-destructive/5 border border-destructive/10">
              <div className="flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-destructive/60 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-[11px] font-semibold text-destructive/70 mb-0.5">
                    Remarcação Solicitada
                  </p>
                  {appointment.motivo_remarcacao && (
                    <p className="text-[10px] text-muted-foreground/50">
                      {appointment.motivo_remarcacao}
                    </p>
                  )}
                </div>
              </div>
              <Button
                onClick={() => setRescheduleModalOpen(true)}
                size="sm"
                className="w-full mt-2 h-8 text-[11px]"
              >
                <Calendar className="w-3 h-3 mr-1.5" />
                Remarcar
              </Button>
            </div>
          )}

          {/* Confirmation */}
          {needsConfirmation && (
            <Button 
              onClick={() => onConfirm?.(appointment.id)}
              size="sm"
              className="w-full mb-2.5 h-8 text-[11px]"
            >
              <Check className="w-3 h-3 mr-1.5" />
              Confirmar Presença
            </Button>
          )}

          {/* Actions */}
          {canCancel && !rescheduleRequested && (
            <div className="flex gap-2">
              <Button 
                onClick={() => setRescheduleModalOpen(true)}
                size="sm"
                variant="outline"
                className="flex-1 h-8 text-[11px] rounded-lg border-border/30"
              >
                Remarcar
              </Button>
              <Button 
                onClick={() => setCancelModalOpen(true)}
                size="sm"
                variant="outline"
                className="flex-1 h-8 text-[11px] rounded-lg border-destructive/20 text-destructive/70 hover:bg-destructive/5"
              >
                Cancelar
              </Button>
            </div>
          )}
        </div>
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
