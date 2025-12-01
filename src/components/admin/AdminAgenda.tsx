import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TimelineView } from "./TimelineView";
import { AppointmentDetailsSidebar } from "./AppointmentDetailsSidebar";
import { ConfirmAttendanceModal } from "./ConfirmAttendanceModal";
import { CancelAllAppointmentsModal } from "./CancelAllAppointmentsModal";
import { ManualBookingModal } from "./ManualBookingModal";
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
  const [cancelAllModalOpen, setCancelAllModalOpen] = useState(false);
  const [manualBookingModalOpen, setManualBookingModalOpen] = useState(false);
  const [selectedEmptySlot, setSelectedEmptySlot] = useState({ date: "", time: "" });
  
  // Filters
  const [filterService, setFilterService] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [services, setServices] = useState<Array<{ id: string; nome: string }>>([]);

  useEffect(() => {
    loadServices();
  }, []);

  useEffect(() => {
    loadAppointments(date);

    // Real-time subscription com múltiplos tratamentos
    const channel = supabase
      .channel('admin-agenda-timeline')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' }, (payload) => {
        console.log('📢 Mudança no agendamento:', payload);
        
        const oldData = payload.old as any;
        const newData = payload.new as any;
        
        // Recarregar sempre que houver mudança
        loadAppointments(date);
        
        if (payload.eventType === 'INSERT') {
          console.log("➕ INSERT detectado:", newData);
          toast.success("🔔 Novo agendamento recebido!");
        } else if (payload.eventType === 'UPDATE') {
          console.log("🔄 UPDATE detectado:", { 
            old: { barbeiro_confirmou: oldData?.barbeiro_confirmou, status: oldData?.status },
            new: { barbeiro_confirmou: newData?.barbeiro_confirmou, status: newData?.status }
          });
          
          // Detectar quando barbeiro confirma
          if (oldData?.barbeiro_confirmou === false && newData?.barbeiro_confirmou === true) {
            console.log("🎉 CONFIRMAÇÃO DETECTADA! Agendamento será adicionado à agenda");
            console.log("📍 Detalhes:", {
              id: newData.id,
              data: newData.data,
              hora: newData.hora,
              status: newData.status,
              barbeiro_confirmou: newData.barbeiro_confirmou
            });
            
            toast.success("✅ Agendamento aprovado! Atualizando agenda...");
            
            // Múltiplos reloads para garantir sincronização
            loadAppointments(date);
            setTimeout(() => {
              console.log("🔄 Reload extra após confirmação");
              loadAppointments(date);
            }, 500);
            setTimeout(() => {
              console.log("🔄 Reload final após confirmação");
              loadAppointments(date);
            }, 1500);
          }
          
          // Detectar cancelamento pelo admin (cancelamento em massa ou individual)
          if (oldData?.status !== 'cancelled_by_admin' && newData?.status === 'cancelled_by_admin') {
            console.log("🚫 Agendamento cancelado pelo administrador");
            // Recarregar imediatamente para remover da lista
            loadAppointments(date);
          }
          
          if (newData.status === 'cancelled_by_user') {
            toast.info("ℹ️ Cliente cancelou um agendamento");
          }
        } else if (payload.eventType === 'DELETE') {
          console.log("🗑️ Agendamento removido");
          loadAppointments(date);
        }
      })
      .subscribe();

    // Polling de backup a cada 15 segundos
    const pollingInterval = setInterval(() => {
      loadAppointments(date);
    }, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollingInterval);
    };
  }, [date]);

  // Check for appointments that need confirmation (when service duration ends)
  useEffect(() => {
    const checkAppointmentCompletion = () => {
      const now = new Date();
      const currentDateStr = format(now, 'yyyy-MM-dd');
      const selectedDateStr = format(date, 'yyyy-MM-dd');
      
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
      const dateStr = format(selectedDate, 'yyyy-MM-dd'); // Format without timezone conversion
      
      console.log(`🔍 Carregando agendamentos para ${dateStr}`);
      console.log(`📋 Filtros: barbeiro_confirmou=true, status NOT IN (cancelled_by_admin, cancelled_by_user)`);
      
      let query = supabase
        .from("agendamentos")
        .select("*")
        .eq("data", dateStr)
        .eq("barbeiro_confirmou", true)
        .neq("status", "cancelled_by_admin")
        .neq("status", "cancelled_by_user")
        .order("hora", { ascending: true });

      const { data, error } = await query;

      if (error) {
        console.error("❌ Erro na query:", error);
        throw error;
      }
      
      console.log(`📊 Encontrados ${data?.length || 0} agendamentos confirmados`);
      
      if (data && data.length > 0) {
        console.log("📝 IDs dos agendamentos:", data.map(a => a.id));
        console.log("⏰ Horários:", data.map(a => a.hora));
        console.log("✅ Status confirmação barbeiro:", data.map(a => a.barbeiro_confirmou));
        console.log("📌 Status:", data.map(a => a.status));
      }

      const appointmentsWithDetails = await Promise.all(
        (data || []).map(async (apt) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("nome, cpf")
            .eq("id", apt.user_id)
            .maybeSingle();

          const { data: servico } = await supabase
            .from("servicos")
            .select("nome, duracao_minutos")
            .eq("id", apt.servico_id)
            .maybeSingle();

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
      
      if (appointmentsWithDetails.length > 0) {
        console.log("✅ Agendamentos processados e exibindo na agenda:");
        appointmentsWithDetails.forEach(a => {
          console.log(`  - ${a.hora}: ${a.servico?.nome || 'Sem serviço'} - ${a.profile?.nome || 'Sem cliente'} (${a.status})`);
        });
      } else {
        console.log("⚠️ Nenhum agendamento encontrado para exibir");
      }
    } catch (error) {
      console.error("❌ Erro ao carregar agendamentos:", error);
      toast.error("Erro ao carregar agendamentos");
    } finally {
      setLoading(false);
    }
  };

  const handleGoToToday = () => {
    setDate(new Date());
  };

  const handleEmptySlotClick = (time: string) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    setSelectedEmptySlot({ date: dateStr, time });
    setManualBookingModalOpen(true);
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

          {filteredAppointments.length > 0 && (
            <Button
              onClick={() => setCancelAllModalOpen(true)}
              variant="destructive"
              size="sm"
            >
              Cancelar Todos
            </Button>
          )}

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
          onEmptySlotClick={handleEmptySlotClick}
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

      {/* Cancel All Appointments Modal */}
      <CancelAllAppointmentsModal
        open={cancelAllModalOpen}
        onOpenChange={setCancelAllModalOpen}
        date={date}
        appointmentsCount={filteredAppointments.length}
        onSuccess={() => loadAppointments(date)}
      />

      {/* Manual Booking Modal */}
      <ManualBookingModal
        open={manualBookingModalOpen}
        onOpenChange={setManualBookingModalOpen}
        date={selectedEmptySlot.date}
        time={selectedEmptySlot.time}
        onSuccess={() => loadAppointments(date)}
      />
    </div>
  );
}
