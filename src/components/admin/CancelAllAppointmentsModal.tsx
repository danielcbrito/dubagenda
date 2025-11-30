import { useState } from "react";
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
import { AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface CancelAllAppointmentsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  appointmentsCount: number;
  onSuccess: () => void;
}

export function CancelAllAppointmentsModal({
  open,
  onOpenChange,
  date,
  appointmentsCount,
  onSuccess,
}: CancelAllAppointmentsModalProps) {
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");

  const handleCancelAll = async () => {
    if (!reason.trim()) {
      toast.error("Por favor, informe o motivo do cancelamento");
      return;
    }

    setCancelling(true);
    try {
      const dateStr = format(date, 'yyyy-MM-dd'); // Format without timezone conversion

      // Buscar todos os agendamentos confirmados do dia
      const { data: appointments, error: fetchError } = await supabase
        .from("agendamentos")
        .select(`
          id, 
          user_id,
          hora,
          servicos!inner(nome)
        `)
        .eq("data", dateStr)
        .eq("barbeiro_confirmou", true)
        .neq("status", "cancelled_by_admin")
        .neq("status", "cancelled_by_user");

      if (fetchError) {
        console.error("Erro ao buscar agendamentos:", fetchError);
        throw new Error(`Erro ao buscar agendamentos: ${fetchError.message}`);
      }

      if (!appointments || appointments.length === 0) {
        toast.info("Não há agendamentos para cancelar neste dia");
        onOpenChange(false);
        return;
      }

      // Cancelar todos os agendamentos
      const { error: updateError } = await supabase
        .from("agendamentos")
        .update({
          status: "cancelled_by_admin",
          cancelado_em: new Date().toISOString(),
          observacoes: `Cancelado em massa: ${reason}`,
        })
        .eq("data", dateStr)
        .eq("barbeiro_confirmou", true)
        .neq("status", "cancelled_by_admin")
        .neq("status", "cancelled_by_user");

      if (updateError) {
        console.error("Erro ao atualizar agendamentos:", updateError);
        throw new Error(`Erro ao cancelar agendamentos: ${updateError.message}`);
      }

      // Criar notificações para todos os usuários afetados
      const notificacoesPromises = appointments.map(apt => {
        const serviceName = apt.servicos?.nome || "Serviço";
        return supabase.from("notificacoes").insert({
          user_id: apt.user_id,
          tipo: "cancelamento_massa",
          titulo: "Agendamento Cancelado",
          mensagem: `Seu agendamento de ${serviceName} às ${apt.hora} foi cancelado. Motivo: ${reason}. Você pode reagendar quando quiser.`,
          agendamento_id: apt.id,
          lida: false,
        });
      });

      const notificacoesResults = await Promise.allSettled(notificacoesPromises);
      
      // Verificar se alguma notificação falhou
      const failedNotifications = notificacoesResults.filter(r => r.status === 'rejected');
      const successCount = appointments.length;
      
      if (failedNotifications.length > 0) {
        console.error("Algumas notificações falharam:", failedNotifications);
        toast.warning(
          `${successCount} agendamento(s) cancelado(s), mas ${failedNotifications.length} notificação(ões) falharam`,
          { duration: 5000 }
        );
      } else {
        toast.success(
          `✅ ${successCount} agendamento(s) cancelado(s) com sucesso! Todos os clientes foram notificados.`,
          { duration: 5000 }
        );
      }
      
      setReason("");
      onOpenChange(false);
      
      // Aguardar um momento para garantir que o banco atualize antes de recarregar
      setTimeout(() => {
        onSuccess();
      }, 500);
    } catch (error: any) {
      console.error("Erro ao cancelar agendamentos:", error);
      
      // Exibir mensagem de erro mais detalhada
      const errorMessage = error?.message || "Erro desconhecido ao cancelar agendamentos";
      toast.error(`Erro: ${errorMessage}`, { duration: 7000 });
      
      // Se for erro de permissão RLS, exibir mensagem específica
      if (error?.message?.includes("policy")) {
        toast.error("Erro de permissão. Verifique se você tem privilégios de administrador.");
      }
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Cancelar Todos os Agendamentos
          </DialogTitle>
          <DialogDescription>
            Esta ação irá cancelar {appointmentsCount} agendamento(s) do dia{" "}
            {date.toLocaleDateString("pt-BR")}. Todos os clientes serão notificados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="reason">Motivo do Cancelamento *</Label>
            <Textarea
              id="reason"
              placeholder="Ex: Emergência pessoal, fechamento do estabelecimento, etc."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-2"
            />
          </div>

          <div className="bg-destructive/10 p-3 rounded-md text-sm">
            ⚠️ <strong>Atenção:</strong> Esta ação não pode ser desfeita. Todos os{" "}
            <strong>{appointmentsCount} agendamento(s)</strong> serão cancelados e os clientes
            receberão uma notificação automática com a opção de remarcar.
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            disabled={cancelling}
          >
            Voltar
          </Button>
          <Button
            onClick={handleCancelAll}
            variant="destructive"
            disabled={cancelling || !reason.trim()}
          >
            {cancelling ? "Cancelando..." : "Confirmar Cancelamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
