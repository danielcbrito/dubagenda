import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Calendar as CalendarIcon, Clock, User } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PendingAppointment {
  id: string;
  data: string;
  hora: string;
  status: string;
  cliente_confirmou: boolean;
  barbeiro_confirmou: boolean;
  profile: { nome: string } | null;
  servico: { nome: string } | null;
}

export function AdminConfirmacoesPendentes() {
  const [appointments, setAppointments] = useState<PendingAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPending();

    const channel = supabase
      .channel('admin-confirmacoes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' }, () => {
        loadPending();
      })
      .subscribe();

    // Fallback polling every 60 seconds
    const pollingInterval = setInterval(() => {
      loadPending();
    }, 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollingInterval);
    };
  }, []);

  const loadPending = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("agendamentos")
        .select("id, data, hora, status, cliente_confirmou, barbeiro_confirmou, user_id, servico_id")
        .in("status", ["pending", "confirmed"])
        .eq("barbeiro_confirmou", false)
        .order("data", { ascending: true })
        .order("hora", { ascending: true });

      if (error) throw error;

      const appointmentsWithDetails = await Promise.all(
        (data || []).map(async (apt) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("nome")
            .eq("id", apt.user_id)
            .single();

          const { data: servico } = await supabase
            .from("servicos")
            .select("nome")
            .eq("id", apt.servico_id)
            .single();

          return {
            ...apt,
            profile: profile || null,
            servico: servico || null,
          };
        })
      );

      setAppointments(appointmentsWithDetails);
    } catch (error) {
      console.error("Error loading pending confirmations:", error);
      toast.error("Erro ao carregar confirmações pendentes");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (appointmentId: string) => {
    try {
      const { error } = await supabase
        .from("agendamentos")
        .update({ barbeiro_confirmou: true })
        .eq("id", appointmentId);

      if (error) throw error;

      // Check if client also confirmed to release point
      const { data: appointment } = await supabase
        .from("agendamentos")
        .select("cliente_confirmou, ponto_liberado")
        .eq("id", appointmentId)
        .single();

      if (appointment?.cliente_confirmou && !appointment?.ponto_liberado) {
        await supabase
          .from("agendamentos")
          .update({ ponto_liberado: true })
          .eq("id", appointmentId);
        
        toast.success("✅ Confirmado! Ponto liberado para o cliente.");
      } else {
        toast.success("✅ Confirmação registrada. Aguardando confirmação do cliente.");
      }

      loadPending();
    } catch (error) {
      console.error("Error confirming appointment:", error);
      toast.error("Erro ao confirmar atendimento");
    }
  };

  const handleReject = async (appointmentId: string) => {
    try {
      const { error } = await supabase
        .from("agendamentos")
        .update({ status: "cancelled_by_admin" })
        .eq("id", appointmentId);

      if (error) throw error;
      toast.success("❌ Atendimento recusado");
      loadPending();
    } catch (error) {
      console.error("Error rejecting appointment:", error);
      toast.error("Erro ao recusar atendimento");
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Confirmações Pendentes</h1>

      {loading ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      ) : appointments.length === 0 ? (
        <Card className="p-12 text-center">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">Nenhuma confirmação pendente no momento</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {appointments.map((apt) => (
            <Card key={apt.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold">{apt.servico?.nome || "Serviço"}</h3>
                    <Badge variant="outline" className="text-xs">
                      Aguardando Confirmação
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-3">
                    <span className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      {apt.profile?.nome || "Cliente"}
                    </span>
                    <span className="flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4" />
                      {format(new Date(apt.data), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {apt.hora}
                    </span>
                  </div>

                  <div className="flex gap-2 text-xs">
                    {apt.cliente_confirmou && (
                      <Badge variant="secondary">✅ Cliente confirmou</Badge>
                    )}
                    {!apt.cliente_confirmou && (
                      <Badge variant="outline">⏳ Aguardando cliente</Badge>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => handleConfirm(apt.id)}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Confirmar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleReject(apt.id)}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Recusar
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
