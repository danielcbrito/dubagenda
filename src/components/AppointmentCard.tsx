import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  pagamentos?: Array<{
    metodo: string;
    status: string;
  }>;
}

interface AppointmentCardProps {
  appointment: Appointment;
  onCancel: (id: string) => void;
  onConfirm?: (id: string) => void;
}

export function AppointmentCard({ appointment, onCancel, onConfirm }: AppointmentCardProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "confirmed":
        return { label: "Confirmado", className: "bg-green-500/20 text-green-500 border-green-500/30" };
      case "completed":
        return { label: "Concluído", className: "bg-gold/20 text-gold border-gold/30" };
      case "pending":
        return { label: "Pendente", className: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30" };
      case "cancelled_by_user":
        return { label: "Cancelado", className: "bg-red-600/30 text-red-500 border-red-500/50" };
      case "cancelled_by_admin":
        return { label: "Cancelado pelo Admin", className: "bg-red-600/30 text-red-500 border-red-500/50" };
      default:
        return { label: status, className: "bg-muted text-muted-foreground border-muted" };
    }
  };

  const statusConfig = getStatusConfig(appointment.status);
  const isCancelled = appointment.status === "cancelled_by_user" || appointment.status === "cancelled_by_admin";
  const canCancel = appointment.status === "pending" || appointment.status === "confirmed";
  const needsConfirmation = appointment.status === "completed" && !appointment.cliente_confirmou && onConfirm;

  const payment = appointment.pagamentos?.[0];
  const isPaid = payment?.status === "paid";

  return (
    <Card className="p-4 bg-card border-border/50 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge className={statusConfig.className}>
              {statusConfig.label}
            </Badge>
            {isPaid && (
              <span className="text-xs text-green-600 font-normal">
                Pago
              </span>
            )}
          </div>
          <h3 className="font-semibold text-foreground">{appointment.servico?.nome || "Serviço"}</h3>
        </div>
      </div>

      <div className="space-y-2 text-sm text-muted-foreground mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          <span>{format(new Date(appointment.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          <span>{appointment.hora}</span>
        </div>
        {appointment.preco && (
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">R$ {appointment.preco.toFixed(2)}</span>
          </div>
        )}
      </div>

      {needsConfirmation && (
        <Button 
          onClick={() => onConfirm?.(appointment.id)}
          size="sm"
          className="w-full mb-2"
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          Confirmar Presença
        </Button>
      )}

      {canCancel && (
        <Button 
          onClick={() => onCancel(appointment.id)}
          size="sm"
          variant="outline"
          className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
        >
          Cancelar
        </Button>
      )}

      {isCancelled && (
        <div className="text-xs text-muted-foreground text-center py-2">
          Cancelado em {appointment.cancelado_em ? format(new Date(appointment.cancelado_em), "dd/MM/yyyy", { locale: ptBR }) : "—"}
        </div>
      )}
    </Card>
  );
}
