import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, CreditCard } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PendingBooking {
  id: string;
  data: string;
  hora: string;
  servico_id: string;
  preco: number;
  payment_method?: string;
  created_at: string;
  servico?: { nome: string };
}

interface PendingPaymentCardProps {
  booking: PendingBooking;
  onResumePayment: (bookingId: string) => void;
  onCancel: (bookingId: string) => void;
}

export function PendingPaymentCard({ booking, onResumePayment, onCancel }: PendingPaymentCardProps) {
  const appointmentDate = new Date(`${booking.data}T12:00:00`);
  const formattedDate = format(appointmentDate, "dd 'de' MMMM", { locale: ptBR });

  return (
    <Card className="p-4 bg-card border-yellow-500/30 hover:border-yellow-500/50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">
              ⏳ Aguardando Pagamento
            </Badge>
          </div>
          <h3 className="font-semibold text-foreground">
            {booking.servico?.nome || "Serviço"}
          </h3>
        </div>
      </div>

      <div className="space-y-2 text-sm text-muted-foreground mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          <span>{formattedDate}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          <span>{booking.hora}</span>
        </div>
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4" />
          <span className="font-semibold text-foreground">
            R$ {booking.preco.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="text-xs text-muted-foreground mb-3 p-2 bg-muted/50 rounded">
        💡 Seu horário está reservado temporariamente. Complete o pagamento para confirmar o agendamento.
      </div>

      <div className="flex gap-2">
        <Button 
          onClick={() => onResumePayment(booking.id)}
          className="flex-1 bg-primary hover:bg-primary/90"
        >
          Finalizar Pagamento
        </Button>
        <Button 
          onClick={() => onCancel(booking.id)}
          variant="outline"
          className="border-destructive/30 text-destructive hover:bg-destructive/10"
        >
          Cancelar
        </Button>
      </div>
    </Card>
  );
}
