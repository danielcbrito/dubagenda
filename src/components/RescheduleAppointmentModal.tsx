import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface RescheduleAppointmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
  currentDate: string;
  currentTime: string;
  serviceName: string;
}

export function RescheduleAppointmentModal({
  open,
  onOpenChange,
  appointmentId,
  currentDate,
  currentTime,
  serviceName,
}: RescheduleAppointmentModalProps) {
  const navigate = useNavigate();

  const handleReschedule = () => {
    sessionStorage.setItem("rescheduleAppointmentId", appointmentId);
    sessionStorage.setItem("isRescheduling", "true");
    onOpenChange(false);
    navigate("/cliente/agendar");
  };

  const dateLabel = (() => {
    try {
      return format(new Date(currentDate + "T00:00:00"), "dd 'de' MMMM", { locale: ptBR });
    } catch {
      return new Date(currentDate).toLocaleDateString("pt-BR");
    }
  })();

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/50 backdrop-blur-[6px]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "duration-200"
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-[360px]",
            "-translate-x-1/2 -translate-y-1/2",
            "bg-card border border-border/40 rounded-2xl overflow-hidden",
            "shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)]",
            "duration-200 ease-out",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-[0.98] data-[state=open]:zoom-in-[0.98]"
          )}
        >
          <DialogPrimitive.Title className="sr-only">Remarcar agendamento</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Escolha uma nova data e horário para o seu agendamento.
          </DialogPrimitive.Description>

          {/* Header */}
          <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-1.5">
                Remarcação
              </p>
              <h2 className="text-[15px] font-semibold text-foreground leading-tight">
                Escolher nova data
              </h2>
            </div>
            <DialogPrimitive.Close
              aria-label="Fechar"
              className="w-7 h-7 -mt-1 -mr-1 rounded-full flex items-center justify-center text-muted-foreground/60 hover:text-foreground active:scale-90 transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </DialogPrimitive.Close>
          </div>

          {/* Agendamento atual */}
          <div className="mx-5 mb-4 rounded-xl border border-border/40 bg-muted/30 dark:bg-background/40 p-3.5">
            <p className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-2.5">
              Agendamento atual
            </p>
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Serviço</span>
                <span className="text-[12px] font-semibold text-foreground text-right truncate">
                  {serviceName}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Data</span>
                <span className="text-[12px] font-semibold text-foreground tabular-nums">
                  {dateLabel}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Horário</span>
                <span className="text-[12px] font-semibold text-foreground tabular-nums">
                  {currentTime}
                </span>
              </div>
            </div>
          </div>

          {/* Nota discreta */}
          <p className="px-5 text-[10px] leading-relaxed text-muted-foreground/70 mb-4">
            Seu agendamento permanece ativo até você confirmar a nova data. Pagamentos já realizados continuam válidos.
          </p>

          {/* CTA */}
          <div className="px-5 pb-5">
            <button
              onClick={handleReschedule}
              className="w-full h-11 rounded-xl bg-foreground text-background text-[13px] font-semibold tracking-tight active:scale-[0.98] transition-transform"
            >
              Escolher nova data
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
