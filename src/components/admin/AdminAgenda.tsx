import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ptBR } from "date-fns/locale";

interface Appointment {
  id: string;
  data: string;
  hora: string;
  status: string;
  preco: number;
  observacoes: string | null;
  profile: { nome: string } | null;
  servico: { nome: string; duracao_minutos: number } | null;
}

export function AdminAgenda() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (date) {
      loadAppointments(date);
    }

    // Real-time subscription
    const channel = supabase
      .channel('admin-agenda')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' }, () => {
        if (date) loadAppointments(date);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [date]);

  const loadAppointments = async (selectedDate: Date) => {
    setLoading(true);
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from("agendamentos")
        .select("id, data, hora, status, preco, observacoes, user_id, servico_id")
        .eq("data", dateStr)
        .order("hora", { ascending: true });

      if (error) throw error;

      // Get profile and service details separately
      const appointmentsWithDetails = await Promise.all(
        (data || []).map(async (apt) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("nome")
            .eq("id", apt.user_id)
            .single();

          const { data: servico } = await supabase
            .from("servicos")
            .select("nome, duracao_minutos")
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
      console.error("Error loading appointments:", error);
      toast.error("Erro ao carregar agendamentos");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAppointment = async (id: string) => {
    try {
      const { error } = await supabase
        .from("agendamentos")
        .update({ status: "cancelled_by_admin" })
        .eq("id", id);

      if (error) throw error;
      toast.success("Agendamento cancelado");
    } catch (error) {
      console.error("Error cancelling:", error);
      toast.error("Erro ao cancelar agendamento");
    }
  };

  const handleConfirmAppointment = async (id: string) => {
    try {
      const { error } = await supabase
        .from("agendamentos")
        .update({ status: "confirmed" })
        .eq("id", id);

      if (error) throw error;
      toast.success("Agendamento confirmado");
    } catch (error) {
      console.error("Error confirming:", error);
      toast.error("Erro ao confirmar agendamento");
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
      confirmed: "bg-green-500/20 text-green-300 border-green-500/30",
      completed: "bg-blue-500/20 text-blue-300 border-blue-500/30",
      cancelled_by_admin: "bg-red-500/20 text-red-300 border-red-500/30",
      cancelled_by_user: "bg-red-500/20 text-red-300 border-red-500/30",
      no_show: "bg-gray-500/20 text-gray-300 border-gray-500/30",
    };
    return colors[status as keyof typeof colors] || colors.pending;
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      pending: "Pendente",
      confirmed: "Confirmado",
      completed: "Concluído",
      cancelled_by_admin: "Cancelado pelo Admin",
      cancelled_by_user: "Cancelado pelo Cliente",
      no_show: "Não Compareceu",
    };
    return labels[status as keyof typeof labels] || status;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Agenda</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="p-6 card-premium lg:col-span-1">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            locale={ptBR}
            className="rounded-md"
          />
        </Card>

        {/* Appointments List */}
        <Card className="p-6 card-premium lg:col-span-2">
          <h3 className="font-semibold text-lg mb-4">
            Agendamentos - {date?.toLocaleDateString('pt-BR', { dateStyle: 'long' })}
          </h3>

          {loading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : appointments.length === 0 ? (
            <p className="text-muted-foreground">Nenhum agendamento para este dia</p>
          ) : (
            <div className="space-y-3">
              {appointments.map((apt) => (
                <div
                  key={apt.id}
                  className="p-4 rounded-lg bg-muted/30 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-lg">{apt.hora}</span>
                        <span className={`px-2 py-1 rounded-full text-xs border ${getStatusColor(apt.status)}`}>
                          {getStatusLabel(apt.status)}
                        </span>
                      </div>
                      <p className="font-medium mt-1">{apt.profile?.nome || "Cliente"}</p>
                      <p className="text-sm text-muted-foreground">
                        {apt.servico?.nome || "Serviço"} ({apt.servico?.duracao_minutos || 0} min)
                      </p>
                      {apt.observacoes && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Obs: {apt.observacoes}
                        </p>
                      )}
                    </div>
                    <span className="font-bold text-primary">
                      R$ {Number(apt.preco).toFixed(2)}
                    </span>
                  </div>

                  {apt.status === "pending" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleConfirmAppointment(apt.id)}
                      >
                        Confirmar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleCancelAppointment(apt.id)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
