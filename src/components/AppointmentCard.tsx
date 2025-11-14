import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
}

interface AppointmentCardProps {
  appointment: Appointment;
  onCancel: (id: string) => void;
  onConfirm?: (id: string) => void;
}

export function AppointmentCard({ appointment, onCancel, onConfirm }: AppointmentCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "confirmed":
        return { label: "Confirmado", className: "bg-green-500/20 text-green-500 border-green-500/30" };
      case "completed":
        return { label: "Concluído", className: "bg-gold/20 text-gold border-gold/30" };
      case "pending":
        return { label: "Pendente", className: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30" };
      case "cancelled_by_user":
        return { label: "Cancelado", className: "bg-destructive/30 text-destructive border-destructive/50" };
      case "cancelled_by_admin":
        return { label: "Cancelado pelo Admin", className: "bg-destructive/30 text-destructive border-destructive/50" };
      default:
        return { label: status, className: "bg-muted text-muted-foreground border-muted" };
    }
  };

  const statusConfig = getStatusConfig(appointment.status);
  const isCancelled = appointment.status === "cancelled_by_user" || appointment.status === "cancelled_by_admin";
  const canCancel = appointment.status === "pending" || appointment.status === "confirmed" || isCancelled;
  const needsConfirmation = appointment.status === "completed" && !appointment.cliente_confirmou && onConfirm;
  
  const getConfirmationStatus = () => {
    if (appointment.ponto_liberado) {
      return { text: "✅ Ponto liberado", variant: "default" as const };
    }
    if (appointment.cliente_confirmou && !appointment.barbeiro_confirmou) {
      return { text: "⏳ Aguardando barbeiro", variant: "secondary" as const };
    }
    if (appointment.cliente_confirmou && appointment.barbeiro_confirmou) {
      return { text: "✅ Confirmado", variant: "default" as const };
    }
    return null;
  };

  const confirmationStatus = getConfirmationStatus();

  return (
    <>
      <Card 
        className="p-4 cursor-pointer hover:shadow-elegant hover:scale-[1.01] transition-all duration-300 border-border/50"
        onClick={() => setDetailsOpen(true)}
      >
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{appointment.servico.nome}</p>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(new Date(appointment.data), "dd 'de' MMMM", { locale: ptBR })}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {appointment.hora}
              </span>
            </div>
            {confirmationStatus && (
              <Badge variant={confirmationStatus.variant} className="text-[9px] mt-2">
                {confirmationStatus.text}
              </Badge>
            )}
          </div>
          <Badge variant="outline" className={`text-[10px] px-2 py-0.5 shrink-0 ${statusConfig.className}`}>
            {statusConfig.label}
          </Badge>
        </div>
      </Card>

      {/* Details Sheet */}
      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] rounded-t-3xl">
          <SheetHeader>
            <SheetTitle className="text-lg">{appointment.servico.nome}</SheetTitle>
            <SheetDescription className="text-xs">
              Detalhes do agendamento
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Data</p>
                <p className="text-sm font-medium">
                  {format(new Date(appointment.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Horário</p>
                <p className="text-sm font-medium">{appointment.hora}</p>
              </div>
            </div>

            {appointment.duracao && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Duração</p>
                <p className="text-sm font-medium">{appointment.duracao} minutos</p>
              </div>
            )}

            {appointment.preco && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Valor</p>
                <p className="text-sm font-medium">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(appointment.preco))}
                </p>
              </div>
            )}

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge variant="outline" className={`text-xs ${statusConfig.className}`}>
                {statusConfig.label}
              </Badge>
              {confirmationStatus && (
                <Badge variant={confirmationStatus.variant} className="text-xs ml-2">
                  {confirmationStatus.text}
                </Badge>
              )}
            </div>

            {appointment.observacoes && !appointment.observacoes.includes('Google Calendar ID') && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Observações</p>
                <p className="text-sm">{appointment.observacoes}</p>
              </div>
            )}

            <div className="space-y-2 pt-2">
              {needsConfirmation && (
                <Button
                  variant="default"
                  className="w-full bg-gold hover:bg-gold/90"
                  onClick={() => {
                    onConfirm!(appointment.id);
                    setDetailsOpen(false);
                  }}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Confirmar Atendimento
                </Button>
              )}

              {canCancel && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      className="w-full"
                    >
                      {isCancelled ? "Remover da Lista" : "Cancelar Agendamento"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {isCancelled ? "Remover da visualização?" : "Cancelar agendamento?"}
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-xs">
                        {isCancelled 
                          ? "Tem certeza que deseja remover este agendamento da lista? Ele não será mais exibido."
                          : "Tem certeza que deseja cancelar este agendamento? Você poderá removê-lo da lista posteriormente."
                        }
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Voltar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          onCancel(appointment.id);
                          setDetailsOpen(false);
                        }}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        {isCancelled ? "Sim, remover" : "Sim, cancelar"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
