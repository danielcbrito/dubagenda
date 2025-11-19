import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, User, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AgendaDiariaViewProps {
  date: Date;
  appointments: any[];
  onCancelAppointment: (id: string) => void;
}

export function AgendaDiariaView({ date, appointments, onCancelAppointment }: AgendaDiariaViewProps) {
  // Generate all hours (8:00 to 20:00)
  const hours = Array.from({ length: 13 }, (_, i) => {
    const hour = 8 + i;
    return `${hour.toString().padStart(2, '0')}:00`;
  });

  const getAppointmentForHour = (hour: string) => {
    return appointments.find(apt => apt.hora === hour);
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "confirmed":
        return { label: "Confirmado", className: "bg-green-500/20 text-green-500" };
      case "completed":
        return { label: "Concluído", className: "bg-gold/20 text-gold" };
      case "pending":
        return { label: "Pendente", className: "bg-yellow-500/20 text-yellow-500" };
      case "cancelled_by_user":
        return { label: "Cancelado", className: "bg-red-500/20 text-red-500" };
      case "cancelled_by_admin":
        return { label: "Cancelado (Admin)", className: "bg-red-500/20 text-red-500" };
      default:
        return { label: status, className: "bg-muted text-muted-foreground" };
    }
  };

  const getPaymentBadge = (appointment: any) => {
    const payment = appointment.pagamentos?.[0];
    if (!payment) return null;

    const methodLabel = {
      'pix': 'PIX',
      'card': 'Cartão',
      'cash': 'Dinheiro'
    }[payment.metodo] || payment.metodo;

    const statusConfig = {
      'paid': { label: 'Pago', className: 'bg-green-500/20 text-green-600' },
      'pending': { label: 'Pendente', className: 'bg-yellow-500/20 text-yellow-600' },
      'failed': { label: 'Falhou', className: 'bg-red-500/20 text-red-600' },
    }[payment.status] || { label: payment.status, className: 'bg-muted text-muted-foreground' };

    return {
      text: `${methodLabel} - ${statusConfig.label}`,
      className: statusConfig.className
    };
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg">
        {format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} - Visão Diária Completa
      </h3>

      <div className="grid gap-2">
        {hours.map((hour) => {
          const appointment = getAppointmentForHour(hour);
          const statusConfig = appointment ? getStatusConfig(appointment.status) : null;

          return (
            <Card key={hour} className={`p-4 ${appointment ? 'border-primary/30' : 'border-border/30 opacity-60'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">{hour}</span>
                  </div>

                  {appointment ? (
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-medium text-sm">{appointment.servico?.nome || "Serviço"}</span>
                        {statusConfig && (
                          <Badge variant="outline" className={`text-xs ${statusConfig.className}`}>
                            {statusConfig.label}
                          </Badge>
                        )}
                        {getPaymentBadge(appointment) && (
                          <Badge variant="outline" className={`text-xs ${getPaymentBadge(appointment)?.className}`}>
                            {getPaymentBadge(appointment)?.text}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <User className="w-3 h-3" />
                        <span>{appointment.profile?.nome || "Cliente"}</span>
                        {appointment.cliente_confirmou && (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="w-3 h-3" />
                            Cliente confirmou
                          </span>
                        )}
                        {appointment.barbeiro_confirmou && (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="w-3 h-3" />
                            Barbeiro confirmou
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Horário livre</span>
                  )}
                </div>

                {appointment && appointment.status !== "cancelled_by_admin" && appointment.status !== "cancelled_by_user" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => onCancelAppointment(appointment.id)}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
