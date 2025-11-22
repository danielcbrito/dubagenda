import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TimelineView } from "./TimelineView";
import { AppointmentDetailsSidebar } from "./AppointmentDetailsSidebar";
import { ConfirmAttendanceModal } from "./ConfirmAttendanceModal";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Filter } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface TimelineAppointment {
  id: string;
  data: string;
  hora: string;
  status: string;
  preco: number;
  observacoes: string | null;
  barbeiro_confirmou: boolean | null;
  cliente_confirmou: boolean | null;
  ponto_liberado: boolean | null;
  user_id: string;
  servico_id: string;
  is_free: boolean | null;
  payment_method: string | null;
  profile: { nome: string; cpf?: string } | null;
  servico: { nome: string; duracao_minutos: number } | null;
  pagamentos: Array<{ metodo: string; status: string; valor: number }>;
}

export function AdminAgenda() {
  const [date, setDate] = useState<Date>(new Date());
  const [appointments, setAppointments] = useState<TimelineAppointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<TimelineAppointment | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmModalAppointment, setConfirmModalAppointment] = useState<TimelineAppointment | null>(null);
  
  // Filters
  const [filterService, setFilterService] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [services, setServices] = useState<Array<{ id: string; nome: string }>>([]);

  useEffect(() => {
    loadServices();
  }, []);

  useEffect(() => {
    loadAppointments(date);

    // Real-time subscription
    const channel = supabase
      .channel('admin-agenda-timeline')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' }, (payload) => {
        console.log('Appointment change:', payload);
        loadAppointments(date);
        
        if (payload.eventType === 'INSERT') {
          toast.success("🔔 Novo agendamento recebido!");
        } else if (payload.eventType === 'UPDATE') {
          const newData = payload.new as any;
          if (newData.status === 'cancelled_by_user') {
            toast.info("ℹ️ Cliente cancelou um agendamento");
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [date]);

  // Check for appointments that need confirmation (when service duration ends)
  useEffect(() => {
    const checkAppointmentCompletion = () => {
      const now = new Date();
      const currentDateStr = now.toISOString().split('T')[0];
      const selectedDateStr = date.toISOString().split('T')[0];
      
      // Only check for today's appointments
      if (currentDateStr !== selectedDateStr) return;

      appointments.forEach(apt => {
        // Skip if already completed, cancelled, or no-show
        if (apt.status === 'completed' || apt.status === 'cancelled_by_admin' || 
            apt.status === 'cancelled_by_user' || apt.status === 'no_show') {
          return;
        }

        // Calculate end time
        const [hours, minutes] = apt.hora.split(':').map(Number);
        const aptStart = new Date(now);
        aptStart.setHours(hours, minutes, 0, 0);
        
        const aptEnd = new Date(aptStart.getTime() + (apt.servico?.duracao_minutos || 30) * 60000);
        
        // If current time is past end time (with 1 minute tolerance)
        if (now >= aptEnd && now.getTime() - aptEnd.getTime() < 120000) {
          // Show confirmation modal
          setConfirmModalAppointment(apt);
        }
      });
    };

    // Check every minute
    const interval = setInterval(checkAppointmentCompletion, 60000);
    checkAppointmentCompletion(); // Check immediately

    return () => clearInterval(interval);
  }, [appointments, date]);

  const loadServices = async () => {
    try {
      const { data, error } = await supabase
        .from("servicos")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error("Error loading services:", error);
    }
  };

  const loadAppointments = async (selectedDate: Date) => {
    setLoading(true);
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      
      let query = supabase
        .from("agendamentos")
        .select("*")
        .eq("data", dateStr)
        .eq("barbeiro_confirmou", true) // APENAS AGENDAMENTOS CONFIRMADOS PELO BARBEIRO
        .order("hora", { ascending: true });

      const { data, error } = await query;

      if (error) throw error;

      const appointmentsWithDetails = await Promise.all(
        (data || []).map(async (apt) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("nome, cpf")
            .eq("id", apt.user_id)
            .single();

          const { data: servico } = await supabase
            .from("servicos")
            .select("nome, duracao_minutos")
            .eq("id", apt.servico_id)
            .single();

          const { data: pagamentos } = await supabase
            .from("pagamentos")
            .select("metodo, status, valor")
            .eq("agendamento_id", apt.id);

          return {
            ...apt,
            profile: profile || null,
            servico: servico || null,
            pagamentos: pagamentos || [],
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

  const handleGoToToday = () => {
    setDate(new Date());
  };

  const filteredAppointments = appointments.filter(apt => {
    if (filterService !== "all" && apt.servico_id !== filterService) return false;
    if (filterStatus !== "all" && apt.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header with filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Agenda do Dia</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {format(date, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleGoToToday} variant="outline" size="sm">
            Hoje
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <CalendarIcon className="mr-2 h-4 w-4" />
                Selecionar Data
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(newDate) => newDate && setDate(newDate)}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>

          <Select value={filterService} onValueChange={setFilterService}>
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Serviço" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os serviços</SelectItem>
              {services.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="confirmed">Confirmado</SelectItem>
              <SelectItem value="completed">Concluído</SelectItem>
              <SelectItem value="cancelled_by_user">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-auto">
        <TimelineView 
          appointments={filteredAppointments}
          loading={loading}
          onSelectAppointment={setSelectedAppointment}
        />
      </div>

      {/* Details Sidebar */}
      <AppointmentDetailsSidebar
        appointment={selectedAppointment}
        open={!!selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
        onUpdate={() => loadAppointments(date)}
      />

      {/* Confirm Attendance Modal */}
      <ConfirmAttendanceModal
        appointment={confirmModalAppointment}
        open={!!confirmModalAppointment}
        onClose={() => setConfirmModalAppointment(null)}
        onUpdate={() => loadAppointments(date)}
      />
    </div>
  );
}
