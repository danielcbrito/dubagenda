import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, User, CreditCard, AlertCircle, CheckCircle2 } from "lucide-react";
import { TimelineAppointment } from "./AdminAgenda";
import { useMemo, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface TimelineViewProps {
  appointments: TimelineAppointment[];
  loading: boolean;
  onSelectAppointment: (appointment: TimelineAppointment) => void;
  onEmptySlotClick: (time: string) => void;
}

export function TimelineView({ appointments, loading, onSelectAppointment, onEmptySlotClick }: TimelineViewProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Generate time slots (8:00 to 20:00, every 30 minutes)
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 8; hour <= 20; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      if (hour < 20) {
        slots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
    }
    return slots;
  }, []);

  const getAppointmentForSlot = (slot: string) => {
    return appointments.find(apt => apt.hora === slot + ":00" || apt.hora === slot);
  };

  const getTimeStatus = (hora: string) => {
    const now = currentTime;
    const [hours, minutes] = hora.split(':').map(Number);
    const slotTime = new Date(now);
    slotTime.setHours(hours, minutes, 0, 0);

    const diffMinutes = Math.floor((slotTime.getTime() - now.getTime()) / 60000);

    if (diffMinutes < -30) return "passed"; // Passou há mais de 30 min
    if (diffMinutes <= 0) return "now"; // É agora
    if (diffMinutes <= 10) return "soon"; // Em 10 minutos
    return "future"; // Futuro
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
      {timeSlots.map((slot) => {
        const appointment = getAppointmentForSlot(slot);
        const timeStatus = getTimeStatus(slot);
        const paymentInfo = appointment ? getPaymentBadge(appointment) : null;
        const PaymentIcon = paymentInfo?.icon;

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
                : "border-l-border/30 opacity-60 hover:opacity-100 hover:bg-primary/5 cursor-pointer hover:border-l-primary"
            )}
            onClick={() => {
              if (appointment) {
                onSelectAppointment(appointment);
              } else {
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
                  timeStatus === "soon" && "text-yellow-500"
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
