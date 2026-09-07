import { Clock, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

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
  index?: number;
}

export function PendingPaymentCard({ 
  booking, 
  onResumePayment, 
  onCancel, 
  index = 0 
}: PendingPaymentCardProps) {
  const appointmentDate = new Date(`${booking.data}T12:00:00`);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.25 }}
      className="relative mb-3 rounded-[24px] overflow-hidden bg-white border border-neutral-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.05)] active:scale-[0.98] transition-transform"
    >
      <div className="p-5">
        {/* Top row: Status Badge + Date/Time */}
        <div className="flex items-center justify-between mb-3">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-medium tracking-tight text-amber-600">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Aguardando Pagamento
          </div>
          
          <div className="flex items-center gap-1.5 text-neutral-400">
            <Calendar className="w-3.5 h-3.5" />
            <span className="text-[12px] font-medium tracking-tight text-neutral-600">
              {format(appointmentDate, "dd MMM", { locale: ptBR })}
            </span>
            <span>•</span>
            <Clock className="w-3.5 h-3.5 text-neutral-400 ml-0.5" />
            <span className="text-[12px] font-medium tracking-tight text-neutral-700">
              {booking.hora}
            </span>
          </div>
        </div>

        {/* Center row: Service Name + Price */}
        <div className="mb-2">
          <h3 className="font-medium text-neutral-900 text-[16px] leading-snug tracking-tight mb-1">
            {booking.servico?.nome || "Serviço"}
          </h3>
          
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-neutral-600 tabular-nums">
              R$ {booking.preco.toFixed(2).replace('.', ',')}
            </span>
          </div>
        </div>

        <p className="text-[12px] text-neutral-400 font-normal">
          Seu horário está reservado temporariamente. Complete o pagamento para confirmar.
        </p>
      </div>

      {/* Actions */}
      <div className="px-4 pb-4">
        <div className="flex gap-2">
          <Button 
            onClick={() => onResumePayment(booking.id)}
            className="flex-1 h-9 rounded-xl bg-neutral-900 text-white font-medium hover:bg-neutral-800 transition-all text-[12px] shadow-none"
          >
            Pagar Agora
          </Button>
          <Button 
            onClick={() => onCancel(booking.id)}
            variant="outline"
            className="flex-1 h-9 rounded-xl border-red-200/60 bg-red-50/40 hover:bg-red-50 text-red-600 font-medium shadow-none transition-all text-[12px]"
          >
            Cancelar
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
