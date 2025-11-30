import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar, X } from "lucide-react";

interface AdminRescheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
  userId: string;
  serviceName: string;
  currentDate: string;
  currentTime: string;
  onSuccess: () => void;
}

export function AdminRescheduleModal({
  open,
  onOpenChange,
  appointmentId,
  userId,
  serviceName,
  currentDate,
  currentTime,
  onSuccess,
}: AdminRescheduleModalProps) {
  const [action, setAction] = useState<"reschedule" | "cancel" | null>(null);
  const [processing, setProcessing] = useState(false);
  const [reason, setReason] = useState("");

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setAction(null);
      setReason("");
      setProcessing(false);
    }
  }, [open]);

  const handleAction = async () => {
    if (!reason.trim()) {
      toast.error("Por favor, informe o motivo");
      return;
    }

    setProcessing(true);
    try {
      if (action === "reschedule") {
        // Marcar como remarcação solicitada SEM cancelar
        const { error: updateError } = await supabase
          .from("agendamentos")
          .update({
            remarcacao_solicitada: true,
            motivo_remarcacao: reason,
            observacoes: `Remarcação solicitada pelo barbeiro: ${reason}`,
          })
          .eq("id", appointmentId);

        if (updateError) throw updateError;

        // Criar notificação para o usuário
        const { error: notifError } = await supabase
          .from("notificacoes")
          .insert({
            user_id: userId,
            tipo: "remarcacao",
            titulo: "Remarcação Solicitada",
            mensagem: `Olá! O barbeiro solicita a remarcação do seu agendamento de ${serviceName}.\n\nMotivo: ${reason}\n\nPor favor, escolha um novo horário disponível no aplicativo.`,
            agendamento_id: appointmentId,
            lida: false,
          });

        if (notifError) throw notifError;

        toast.success("Solicitação de remarcação enviada ao cliente");
      } else if (action === "cancel") {
        // Cancelar definitivamente
        const { error: updateError } = await supabase
          .from("agendamentos")
          .update({
            status: "cancelled_by_admin",
            cancelado_em: new Date().toISOString(),
            observacoes: `Cancelamento definitivo: ${reason}`,
          })
          .eq("id", appointmentId);

        if (updateError) throw updateError;

        // Criar notificação para o usuário
        const { error: notifError } = await supabase
          .from("notificacoes")
          .insert({
            user_id: userId,
            tipo: "cancelamento",
            titulo: "Agendamento Cancelado",
            mensagem: `Seu agendamento de ${serviceName} foi cancelado. Motivo: ${reason}. Este agendamento não poderá ser remarcado.`,
            agendamento_id: appointmentId,
            lida: false,
          });

        if (notifError) throw notifError;

        toast.success("Agendamento cancelado e cliente notificado");
      }

      setReason("");
      setAction(null);
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Erro ao processar ação:", error);
      
      // Exibir mensagem de erro mais detalhada
      const errorMessage = error?.message || "Erro desconhecido ao processar a ação";
      toast.error(errorMessage);
      
      // Se for erro de permissão RLS, exibir mensagem específica
      if (error?.message?.includes("policy")) {
        toast.error("Erro de permissão. Verifique se você tem privilégios de administrador.");
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {action === "reschedule" ? (
              <Calendar className="w-5 h-5" />
            ) : (
              <X className="w-5 h-5 text-destructive" />
            )}
            {action === "reschedule" ? "Solicitar Remarcação" : "Cancelar Agendamento"}
          </DialogTitle>
          <DialogDescription>
            Agendamento: {serviceName} - {new Date(currentDate).toLocaleDateString("pt-BR")} às{" "}
            {currentTime}
          </DialogDescription>
        </DialogHeader>

        {!action ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Escolha uma ação:</p>
            <Button
              onClick={() => setAction("reschedule")}
              variant="outline"
              className="w-full justify-start h-auto py-4"
            >
              <div className="text-left">
                <div className="font-semibold flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Solicitar Remarcação
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  O cliente receberá uma mensagem para escolher um novo horário
                </div>
              </div>
            </Button>
            <Button
              onClick={() => setAction("cancel")}
              variant="outline"
              className="w-full justify-start h-auto py-4 border-destructive/30"
            >
              <div className="text-left">
                <div className="font-semibold flex items-center gap-2 text-destructive">
                  <X className="w-4 h-4" />
                  Cancelar Definitivamente
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  O agendamento será cancelado sem opção de remarcar
                </div>
              </div>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="reason">
                Motivo {action === "reschedule" ? "da Remarcação" : "do Cancelamento"} *
              </Label>
              <Textarea
                id="reason"
                placeholder="Ex: Conflito de horários, emergência, etc."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="mt-2"
              />
            </div>

            <div className="bg-primary/10 p-3 rounded-md text-sm">
              ℹ️ O cliente será notificado automaticamente através do aplicativo.
            </div>
          </div>
        )}

        <DialogFooter className="flex gap-2">
          <Button
            onClick={() => {
              if (action) {
                setAction(null);
                setReason("");
              } else {
                onOpenChange(false);
              }
            }}
            variant="outline"
            disabled={processing}
          >
            {action ? "Voltar" : "Cancelar"}
          </Button>
          {action && (
            <Button
              onClick={handleAction}
              disabled={processing || reason.trim().length === 0}
              variant={action === "cancel" ? "destructive" : "default"}
              className={reason.trim().length > 0 ? "opacity-100" : "opacity-50"}
            >
              {processing ? "Processando..." : "Confirmar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
