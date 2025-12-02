import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, User, CreditCard, AlertCircle, CheckCircle2 } from "lucide-react";
import { TimelineAppointment } from "./AdminAgenda";
import { useMemo, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TimelineViewProps {
  appointments: TimelineAppointment[];
  loading: boolean;
  selectedDate: Date; // Data selecionada na agenda
  onSelectAppointment: (appointment: TimelineAppointment) => void;
  onEmptySlotClick: (time: string) => void;
}

export function TimelineView({ appointments, loading, selectedDate, onSelectAppointment, onEmptySlotClick }: TimelineViewProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [clickedUnavailableSlot, setClickedUnavailableSlot] = useState<string | null>(null);

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Generate time slots (9:00 to 20:00, every 30 minutes)
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 9; hour <= 20; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      if (hour < 20) {
        slots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
    }
    return slots;
  }, []);

  // Get the appointment that starts at this slot
  const getAppointmentForSlot = (slot: string) => {
    return appointments.find(apt => apt.hora === slot + ":00" || apt.hora === slot);
  };

  // Check if a slot is blocked by another appointment's duration (overlap check)
  const isSlotBlockedByDuration = (slot: string): { blocked: boolean; blockingAppointment: TimelineAppointment | null } => {
    const [slotHour, slotMin] = slot.split(':').map(Number);
    const slotStart = slotHour * 60 + slotMin;
    const bufferTime = 10; // 10 minute buffer

    for (const apt of appointments) {
      const [aptHour, aptMin] = apt.hora.split(':').map(Number);
      const aptStart = aptHour * 60 + aptMin;
      const aptEnd = aptStart + (apt.servico?.duracao_minutos || 30) + bufferTime;

      // If this slot starts within the duration of an existing appointment
      if (slotStart > aptStart && slotStart < aptEnd) {
        return { blocked: true, blockingAppointment: apt };
      }
    }

    return { blocked: false, blockingAppointment: null };
  };

  // Check if slot is during lunch break (13:00-14:00)
  const isLunchBreak = (slot: string): boolean => {
    const [hour] = slot.split(':').map(Number);
    return hour === 13;
  };

  // Compara DATA + HORA completa para determinar status
  const getTimeStatus = (hora: string, appointmentDateStr?: string) => {
    const now = currentTime;
    const [hours, minutes] = hora.split(':').map(Number);
    
    // Usar a data do agendamento se disponível, senão usar a data selecionada na agenda
    let slotTime: Date;
    if (appointmentDateStr) {
      // Parse da data do agendamento (formato YYYY-MM-DD)
      const [year, month, day] = appointmentDateStr.split('-').map(Number);
      slotTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
    } else {
      // Usar a data selecionada na agenda
      slotTime = new Date(selectedDate);
      slotTime.setHours(hours, minutes, 0, 0);
    }

    const diffMinutes = Math.floor((slotTime.getTime() - now.getTime()) / 60000);

    // Se a diferença for muito grande (mais de um dia no futuro), é futuro
    if (diffMinutes > 60 * 24) return "future";
    
    if (diffMinutes < -30) return "passed";
    if (diffMinutes <= 0) return "now";
    if (diffMinutes <= 10) return "soon";
    return "future";
  };

  const getServiceColor = (serviceName: string | undefined) => {
    if (!serviceName) return "bg-muted";
    
    const colors: Record<string, string> = {
      "corte": "bg-blue-500",
      "barba": "bg-amber-500",
      "combo": "bg-purple-500",
      "sobrancelha": "bg-pink-500",
      "pezinho": "bg-green-500",
    };

    const key = Object.keys(colors).find(k => serviceName.toLowerCase().includes(k));
    return key ? colors[key] : "bg-primary";
  };

  const getPaymentBadge = (appointment: TimelineAppointment) => {
    const payment = appointment.pagamentos?.[0];
    if (!payment) return { icon: AlertCircle, text: "Sem pagamento", className: "bg-red-500/20 text-red-600" };

    const methodLabel = {
      'pix': 'PIX',
      'card': 'Cartão',
      'cash': 'Dinheiro'
    }[payment.metodo] || payment.metodo;

    const statusConfig = {
      'paid': { icon: CheckCircle2, text: 'Pago', className: 'bg-green-500/20 text-green-600' },
      'pending': { icon: Clock, text: 'Pendente', className: 'bg-yellow-500/20 text-yellow-600' },
      'failed': { icon: AlertCircle, text: 'Falhou', className: 'bg-red-500/20 text-red-600' },
    }[payment.status] || { icon: AlertCircle, text: payment.status, className: 'bg-muted text-muted-foreground' };

    return {
      ...statusConfig,
      text: `${methodLabel} - ${statusConfig.text}`
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-2 pb-8">
      {/* Mensagem de slot indisponível */}
      {clickedUnavailableSlot && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-center mb-4">
          <p className="text-sm text-destructive font-medium">
            Este horário já foi agendado.
          </p>
        </div>
      )}

      {timeSlots.map((slot) => {
        const appointment = getAppointmentForSlot(slot);
        // Passar a data do agendamento para comparação correta
        const timeStatus = getTimeStatus(slot, appointment?.data);
        const paymentInfo = appointment ? getPaymentBadge(appointment) : null;
        const PaymentIcon = paymentInfo?.icon;
        const lunchBreak = isLunchBreak(slot);
        const { blocked: isBlockedByDuration } = !appointment ? isSlotBlockedByDuration(slot) : { blocked: false };

        // Render lunch break slots
        if (lunchBreak) {
          return (
            <Card 
              key={slot}
              className="p-4 transition-all duration-300 border-l-4 border-l-amber-500/50 opacity-40 bg-amber-500/5"
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 min-w-[80px]">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold text-sm text-muted-foreground">{slot}</span>
                </div>
                <span className="text-sm text-muted-foreground italic">Horário de almoço</span>
              </div>
            </Card>
          );
        }

        return (
          <Card 
            key={slot}
            className={cn(
              "p-4 transition-all duration-300 border-l-4",
              appointment 
                ? cn(
                    "cursor-pointer hover:shadow-lg hover:scale-[1.01]",
                    timeStatus === "now" && "border-l-green-500 bg-green-500/5 animate-pulse",
                    timeStatus === "soon" && "border-l-yellow-500 bg-yellow-500/5",
                    timeStatus === "passed" && appointment.status !== "completed" && "border-l-red-500 bg-red-500/5",
                    timeStatus === "future" && "border-l-primary/50",
                    appointment.status === "completed" && "border-l-blue-500 bg-blue-500/5 opacity-75"
                  )
                : isBlockedByDuration
                  ? "border-l-muted/30 opacity-30 cursor-not-allowed bg-muted/10"
                  : "border-l-border/30 opacity-60 hover:opacity-100 hover:bg-primary/5 cursor-pointer hover:border-l-primary"
            )}
            onClick={() => {
              if (appointment) {
                onSelectAppointment(appointment);
              } else if (isBlockedByDuration) {
                setClickedUnavailableSlot(slot);
                toast.error("Este horário já foi agendado.");
                setTimeout(() => setClickedUnavailableSlot(null), 3000);
              } else {
                setClickedUnavailableSlot(null);
                onEmptySlotClick(slot);
              }
            }}
          >
            <div className="flex items-center gap-4">
              {/* Time */}
              <div className="flex items-center gap-2 min-w-[80px]">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className={cn(
                  "font-semibold text-sm",
                  timeStatus === "now" && "text-green-500",
                  timeStatus === "soon" && "text-yellow-500",
                  isBlockedByDuration && "text-muted-foreground/50"
                )}>
                  {slot}
                </span>
              </div>

              {appointment ? (
                <div className="flex-1 flex items-center justify-between gap-4">
                  {/* Service indicator */}
                  <div className={cn(
                    "w-2 h-12 rounded-full",
                    getServiceColor(appointment.servico?.nome)
                  )} />

                  {/* Appointment info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{appointment.servico?.nome || "Serviço"}</span>
                      <Badge variant="outline" className="text-xs">
                        {appointment.servico?.duracao_minutos || 0} min
                      </Badge>
                      {timeStatus === "now" && (
                        <Badge className="bg-green-500 text-white animate-pulse">
                          É AGORA
                        </Badge>
                      )}
                      {timeStatus === "soon" && (
                        <Badge className="bg-yellow-500 text-white">
                          Em breve
                        </Badge>
                      )}
                      {timeStatus === "passed" && appointment.status !== "completed" && (
                        <Badge variant="destructive">
                          Atrasado
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <User className="w-3 h-3" />
                        <span>{appointment.profile?.nome || "Cliente"}</span>
                      </div>
                      
                      {appointment.is_free ? (
                        <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                          Corte Grátis
                        </Badge>
                      ) : (
                        <>
                          {paymentInfo && PaymentIcon && (
                            <Badge variant="outline" className={paymentInfo.className}>
                              <PaymentIcon className="w-3 h-3 mr-1" />
                              {paymentInfo.text}
                            </Badge>
                          )}
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-3 h-3" />
                            <span className="font-medium">R$ {appointment.preco.toFixed(2)}</span>
                          </div>
                        </>
                      )}

                      {appointment.cliente_confirmou && (
                        <Badge variant="outline" className="bg-green-500/20 text-green-600">
                          Cliente confirmou
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ) : isBlockedByDuration ? (
                <div className="flex items-center justify-between flex-1">
                  <span className="text-sm text-muted-foreground/50 italic">Ocupado (serviço em andamento)</span>
                  <Badge variant="outline" className="text-xs bg-muted/20 text-muted-foreground/50">
                    Indisponível
                  </Badge>
                </div>
              ) : (
                <div className="flex items-center justify-between flex-1">
                  <span className="text-sm text-muted-foreground">Horário livre</span>
                  <Badge variant="outline" className="text-xs bg-primary/10">
                    Clique para encaixar
                  </Badge>
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
