import { useState } from "react";
import { Calendar, Clock, Check, AlertCircle, X, Crown, Gift, Scissors, Store, Star } from "lucide-react";
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
          color: "#16a34a",
          bgColor: "rgba(22, 163, 74, 0.12)",
          borderColor: "rgba(22, 163, 74, 0.25)",
          icon: Check,
        };
      case "cancelled_by_admin":
        return { 
          label: "Cancelado pela barbearia", 
          color: "hsl(var(--destructive))",
          bgColor: "hsl(var(--destructive) / 0.06)",
          borderColor: "hsl(var(--destructive) / 0.12)",
          icon: X,
        };
      case "cancelled_by_user":
        return { 
          label: "Cancelado por você", 
          color: "hsl(var(--destructive))",
          bgColor: "hsl(var(--destructive) / 0.06)",
          borderColor: "hsl(var(--destructive) / 0.12)",
          icon: X,
        };
      case "no_show":
        return {
          label: "Faltou",
          color: "hsl(var(--muted-foreground))",
          bgColor: "hsl(var(--muted) / 0.08)",
          borderColor: "hsl(var(--border) / 0.3)",
          icon: AlertCircle,
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
  const isCancelledByAdmin = appointment.status === "cancelled_by_admin";
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

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.06, duration: 0.25 }}
        className="rounded-xl overflow-hidden border border-border/60 bg-card active:scale-[0.99] transition-transform"
        style={{ boxShadow: "0 1px 4px hsl(var(--foreground) / 0.06)" }}
      >
        {/* Top accent bar with status color */}
        <div className="h-[3px]" style={{ background: statusConfig.color }} />

        <div className="px-4 pt-3 pb-3">
          {/* Top row: Service + Date circle (top-right) */}
          <div className="flex items-start justify-between gap-3 mb-0">
            <h3 className="font-bold text-foreground text-[15px] leading-snug break-words flex-1 min-w-0">
              {appointment.servico?.nome || "Serviço"}
            </h3>
            <div className="flex flex-col items-center flex-shrink-0">
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground leading-none">
                {format(new Date(`${appointment.data}T12:00:00`), "EEE", { locale: ptBR })}
              </span>
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center mt-0.5"
                style={{ background: statusConfig.bgColor, border: `1.5px solid ${statusConfig.borderColor}` }}
              >
                <span className="text-[16px] font-bold tabular-nums" style={{ color: statusConfig.color }}>
                  {format(new Date(`${appointment.data}T12:00:00`), "dd")}
                </span>
              </div>
            </div>
          </div>

          {/* Shop + Barber only */}
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5 -mt-4">
            <div className="flex items-center gap-1 px-2 py-[3px] rounded-md bg-muted/70 border border-border/30">
              <Store className="w-3 h-3 text-foreground/50" />
              <span className="text-[10px] font-semibold text-foreground/70 truncate">{shopName}</span>
            </div>
            {appointment.barbeiro?.apelido && (
              <div className="flex items-center gap-1 px-2 py-[3px] rounded-md bg-muted/70 border border-border/30">
                <Scissors className="w-3 h-3 text-foreground/50" />
                <span className="text-[10px] font-semibold text-foreground/70 truncate">{appointment.barbeiro.apelido}</span>
              </div>
            )}
          </div>

          {/* Bottom row: Time · Value ——— Status (right) */}
          <div className="flex items-center gap-2.5 text-[11px] pt-2.5 mt-1 border-t border-border/20">
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-foreground/40" />
              <span className="font-semibold text-foreground/70 tabular-nums">{appointment.hora}</span>
            </div>

            <span className="text-border">·</span>

            {isPlanAppointment ? (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary border border-primary/20 shadow-sm">
                <Star className="w-3 h-3 text-primary-foreground fill-primary-foreground" />
                <span className="text-[10px] font-bold text-primary-foreground uppercase tracking-wider">Plano</span>
              </div>
            ) : isFreeAppointment ? (
              <div className="flex items-center gap-1">
                <Gift className="w-3 h-3 text-secondary" />
                <span className="text-[10px] font-bold text-secondary">Grátis</span>
              </div>
            ) : appointment.preco ? (
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-foreground tabular-nums">
                  R$ {appointment.preco.toFixed(2)}
                </span>
                {isPaid && (
                  <span className="text-[8px] text-primary font-bold uppercase tracking-wider bg-primary/10 px-1 py-0.5 rounded">
                    Pago
                  </span>
                )}
              </div>
            ) : null}

            <span className="flex-1" />

            {/* Status badge — bottom right */}
            <div
              className="flex items-center gap-1 px-2 py-[3px] rounded-md text-[8px] font-bold uppercase tracking-wider flex-shrink-0 max-w-[138px] justify-center text-center leading-tight"
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

          {isCancelledByAdmin && (
            <div className="mt-2.5 rounded-lg border border-destructive/10 bg-destructive/5 px-3 py-2 transition-opacity duration-300">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-destructive/80">
                A barbearia cancelou este horário
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground/70 leading-snug">
                Ele fica visível aqui por 48h para acompanhamento.
              </p>
            </div>
          )}
        </div>

        {/* Action sections */}
        {hasActionSection && (
          <div className="px-4 pb-4">
            {/* Reschedule banner */}
            {rescheduleRequested && !isCancelled && (
              <div className="mt-1 p-2.5 rounded-lg bg-destructive/5 border border-destructive/10">
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


            {/* Actions */}
            {canCancel && !rescheduleRequested && (
              <div className="flex gap-2 mt-1">
                <Button
                  onClick={() => setRescheduleModalOpen(true)}
                  size="sm"
                  variant="outline"
                  className="flex-1 h-8 text-[11px] rounded-lg border-border/40"
                >
                  Remarcar
                </Button>
                <Button
                  onClick={() => setCancelModalOpen(true)}
                  size="sm"
                  variant="outline"
                  className="flex-1 h-8 text-[11px] rounded-lg border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
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
