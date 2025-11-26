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
      const dateStr = date.toISOString().split('T')[0];

      // Buscar todos os agendamentos confirmados do dia
      const { data: appointments, error: fetchError } = await supabase
        .from("agendamentos")
        .select("id, user_id, servico:servicos(nome), hora, profile:profiles(nome)")
        .eq("data", dateStr)
        .eq("barbeiro_confirmou", true)
        .neq("status", "cancelled_by_admin")
        .neq("status", "cancelled_by_user");

      if (fetchError) throw fetchError;

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

      if (updateError) throw updateError;

      // Criar notificações para todos os usuários afetados
      const notificacoesPromises = appointments.map(apt => 
        supabase.from("notificacoes").insert({
          user_id: apt.user_id,
          tipo: "cancelamento_massa",
          titulo: "Agendamento Cancelado",
          mensagem: `Seu agendamento de ${apt.servico?.nome} às ${apt.hora} foi cancelado. Motivo: ${reason}. Você pode reagendar quando quiser.`,
          agendamento_id: apt.id,
          lida: false,
        })
      );

      await Promise.all(notificacoesPromises);

      toast.success(`${appointments.length} agendamento(s) cancelado(s) com sucesso`);
      setReason("");
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Erro ao cancelar agendamentos:", error);
      toast.error("Erro ao cancelar agendamentos");
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
            ⚠️ Esta ação não pode ser desfeita. Todos os clientes receberão uma notificação e
            poderão remarcar seus horários.
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
