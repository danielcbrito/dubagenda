import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { AgendaMensalView } from "./AgendaMensalView";
import { AgendaDiariaView } from "./AgendaDiariaView";

interface Appointment {
  id: string;
  data: string;
  hora: string;
  status: string;
  preco: number;
  observacoes: string | null;
  cancelado_em?: string | null;
  visivel_para_usuario?: boolean;
  barbeiro_confirmou?: boolean;
  cliente_confirmou?: boolean;
  ponto_liberado?: boolean;
  profile: { nome: string } | null;
  servico: { nome: string; duracao_minutos: number } | null;
}

export function AdminAgenda() {
  const [date, setDate] = useState<Date>(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState<"mensal" | "diaria">("mensal");

  useEffect(() => {
    loadAppointments(date);
    loadAllAppointments();

    // Real-time subscription
    const channel = supabase
      .channel('admin-agenda')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' }, (payload) => {
        console.log('Appointment change in admin:', payload);
        loadAppointments(date);
        loadAllAppointments();
        
        // Show notification for status changes
        if (payload.eventType === 'UPDATE') {
          const newData = payload.new as any;
          if (newData.status === 'cancelled_by_user') {
            toast.info("Cliente cancelou um agendamento");
          }
        } else if (payload.eventType === 'INSERT') {
          toast.success("Novo agendamento recebido!");
        }
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
        .select("id, data, hora, status, preco, observacoes, cancelado_em, visivel_para_usuario, barbeiro_confirmou, cliente_confirmou, ponto_liberado, user_id, servico_id")
        .eq("data", dateStr)
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

  const loadAllAppointments = async () => {
    try {
      const { data, error } = await supabase
        .from("agendamentos")
        .select("id, data, hora, status, preco, observacoes, cancelado_em, visivel_para_usuario, barbeiro_confirmou, cliente_confirmou, ponto_liberado, user_id, servico_id")
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

      setAllAppointments(appointmentsWithDetails);
    } catch (error) {
      console.error("Error loading all appointments:", error);
    }
  };

  const handleCancelAppointment = async (id: string) => {
    try {
      // Read event id from observacoes to sync Calendar
      const { data: apt } = await supabase
        .from("agendamentos")
        .select("observacoes")
        .eq("id", id)
        .maybeSingle();

      const { error } = await supabase
        .from("agendamentos")
        .update({ status: "cancelled_by_admin" } as any)
        .eq("id", id);

      if (error) throw error;

      if (apt?.observacoes?.includes("Google Calendar ID:")) {
        const eventId = apt.observacoes.split("Google Calendar ID: ")[1];
        await supabase.functions.invoke('google-calendar-sync', {
          body: {
            action: 'update',
            eventId,
            appointmentId: id,
            summaryPrefix: '❌ Cancelado - '
          }
        }).catch(err => console.warn('Calendar update failed:', err));
      }

      toast.success("Agendamento cancelado");
    } catch (error) {
      console.error("Error cancelling:", error);
      toast.error("Erro ao cancelar agendamento");
    }
  };

  const handleConfirmAppointment = async (id: string) => {
    try {
      // Mark barber confirmation
      const { error: updError } = await supabase
        .from("agendamentos")
        .update({ barbeiro_confirmou: true } as any)
        .eq("id", id);

      if (updError) throw updError;

      // Check if client also confirmed
      const { data: row } = await supabase
        .from("agendamentos")
        .select("cliente_confirmou, ponto_liberado")
        .eq("id", id)
        .single();

      const clientConfirmed = (row as any)?.cliente_confirmou;
      const pointReleased = (row as any)?.ponto_liberado;

      if (clientConfirmed && !pointReleased) {
        // Release point and complete
        const { error: completeErr } = await supabase
          .from("agendamentos")
          .update({ ponto_liberado: true, status: 'completed' as any } as any)
          .eq("id", id);
        if (completeErr) throw completeErr;
        toast.success("✅ Atendimento confirmado e ponto liberado");
      } else {
        // Keep as confirmed until client confirms
        const { error: statusErr } = await supabase
          .from("agendamentos")
          .update({ status: 'confirmed' as any } as any)
          .eq("id", id);
        if (statusErr) throw statusErr;
        toast.success("✅ Atendimento confirmado (aguardando cliente)");
      }
    } catch (error) {
      console.error("Error confirming agendamento:", error);
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

      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as "mensal" | "diaria")}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="mensal">Visão Mensal</TabsTrigger>
          <TabsTrigger value="diaria">Visão Diária</TabsTrigger>
        </TabsList>

        <TabsContent value="mensal" className="mt-6">
          <AgendaMensalView 
            appointments={allAppointments}
            onSelectDate={(newDate) => {
              setDate(newDate);
              setActiveView("diaria");
            }}
          />
        </TabsContent>

        <TabsContent value="diaria" className="mt-6">
          <AgendaDiariaView 
            date={date}
            appointments={appointments}
            onCancelAppointment={handleCancelAppointment}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
