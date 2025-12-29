import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfWeek, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { LayoutGrid, List, Plus, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

import { CompactWeekSelector } from "@/components/admin/agenda/CompactWeekSelector";
import { PremiumTimeline } from "@/components/admin/agenda/PremiumTimeline";
import { EnhancedWeekView } from "@/components/admin/agenda/EnhancedWeekView";
import { AppointmentDetailsSidebar } from "@/components/admin/AppointmentDetailsSidebar";
import { ConfirmAttendanceModal } from "@/components/admin/ConfirmAttendanceModal";
import { MobileManualBookingModal } from "@/components/admin/mobile/MobileManualBookingModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TimelineAppointment } from "@/components/admin/AdminAgenda";

interface BarberAgendaProps {
  barbeiroId: string;
}

type ViewMode = "day" | "week";

export function BarberAgenda({ barbeiroId }: BarberAgendaProps) {
  const [date, setDate] = useState<Date>(new Date());
  const [appointments, setAppointments] = useState<TimelineAppointment[]>([]);
  const [allAppointments, setAllAppointments] = useState<Array<{ data: string; status: string }>>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<TimelineAppointment | null>(null);
  const [confirmModalAppointment, setConfirmModalAppointment] = useState<TimelineAppointment | null>(null);
  const [manualBookingModalOpen, setManualBookingModalOpen] = useState(false);
  const [selectedEmptySlot, setSelectedEmptySlot] = useState({ date: "", time: "" });
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [filterService, setFilterService] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [services, setServices] = useState<Array<{ id: string; nome: string }>>([]);
  const [showFilters, setShowFilters] = useState(false);
  
  const isInitialLoad = useRef(true);

  useEffect(() => {
    loadServices();
  }, []);

  const loadAppointments = useCallback(async (selectedDate: Date, silent = false) => {
    try {
      const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
      const weekDates = Array.from({ length: 6 }, (_, i) => 
        format(addDays(weekStart, i), 'yyyy-MM-dd')
      );
      
      const { data, error } = await supabase
        .from("agendamentos")
        .select("*")
        .eq("barbeiro_id", barbeiroId)
        .in("data", weekDates)
        .in("status", ["pending", "confirmed", "completed"])
        .order("hora", { ascending: true });

      if (error) throw error;

      const appointmentsWithDetails = await Promise.all(
        (data || []).map(async (apt) => {
          const [profileRes, servicoRes, pagamentosRes] = await Promise.all([
            supabase.from("profiles").select("nome, cpf").eq("id", apt.user_id).maybeSingle(),
            supabase.from("servicos").select("nome, duracao_minutos").eq("id", apt.servico_id).maybeSingle(),
            supabase.from("pagamentos").select("metodo, status, valor").eq("agendamento_id", apt.id)
          ]);

          return {
            ...apt,
            profile: profileRes.data || null,
            servico: servicoRes.data || null,
            pagamentos: pagamentosRes.data || [],
          };
        })
      );

      setAppointments(appointmentsWithDetails);
      if (isInitialLoad.current) {
        isInitialLoad.current = false;
      }
    } catch (error) {
      console.error("Error loading appointments:", error);
      if (!silent) toast.error("Erro ao carregar agendamentos");
    }
  }, [barbeiroId]);

  const loadAllAppointments = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("agendamentos")
        .select("data, status")
        .eq("barbeiro_id", barbeiroId)
        .in("status", ["pending", "confirmed", "completed"]);

      if (error) throw error;
      setAllAppointments(data || []);
    } catch (error) {
      console.error("Error loading all appointments:", error);
    }
  }, [barbeiroId]);

  useEffect(() => {
    loadAppointments(date);
    loadAllAppointments();

    const channel = supabase
      .channel('barber-agenda-premium')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'agendamentos',
        filter: `barbeiro_id=eq.${barbeiroId}`
      }, (payload) => {
        loadAppointments(date, true);
        loadAllAppointments();
        
        if (payload.eventType === 'INSERT') {
          toast.success("Novo agendamento recebido!");
        }
      })
      .subscribe();

    const pollingInterval = setInterval(() => {
      loadAppointments(date, true);
    }, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollingInterval);
    };
  }, [date, loadAppointments, loadAllAppointments, barbeiroId]);

  useEffect(() => {
    const checkAppointmentCompletion = () => {
      const now = new Date();
      const currentDateStr = format(now, 'yyyy-MM-dd');
      
      const todaysAppointments = appointments.filter(apt => apt.data === currentDateStr);

      todaysAppointments.forEach(apt => {
        if (apt.status === 'completed' || apt.status === 'cancelled_by_admin' || 
            apt.status === 'cancelled_by_user' || apt.status === 'no_show') {
          return;
        }

        const [hours, minutes] = apt.hora.split(':').map(Number);
        const aptStart = new Date(now);
        aptStart.setHours(hours, minutes, 0, 0);
        const aptEnd = new Date(aptStart.getTime() + (apt.servico?.duracao_minutos || 30) * 60000);
        
        if (now >= aptEnd && now.getTime() - aptEnd.getTime() < 120000) {
          setConfirmModalAppointment(apt);
        }
      });
    };

    const interval = setInterval(checkAppointmentCompletion, 60000);
    checkAppointmentCompletion();
    return () => clearInterval(interval);
  }, [appointments]);

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

  const handleEmptySlotClick = (dateStr: string, time: string) => {
    setSelectedEmptySlot({ date: dateStr, time });
    setManualBookingModalOpen(true);
  };

  const handleTodayClick = () => {
    setDate(new Date());
  };

  const filteredAppointments = appointments.filter(apt => {
    if (filterService !== "all" && apt.servico_id !== filterService) return false;
    if (filterStatus !== "all" && apt.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-5 animate-fade-in pb-16 relative">
      {/* Header Row: Title + Controls */}
      <div className="flex-shrink-0 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-wide">Minha Agenda</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie seus agendamentos
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-xl bg-white/5 p-1">
            <button
              onClick={() => setViewMode("week")}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                viewMode === "week" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="w-4 h-4" />
              Semana
            </button>
            <button
              onClick={() => setViewMode("day")}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                viewMode === "day" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="w-4 h-4" />
              Dia
            </button>
          </div>

          {/* Filters Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all",
              showFilters ? "bg-primary/10 text-primary" : "bg-white/5 text-muted-foreground hover:bg-white/10"
            )}
          >
            <Filter className="w-4 h-4" />
            Filtros
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="flex flex-wrap gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/5"
        >
          <Select value={filterService} onValueChange={setFilterService}>
            <SelectTrigger className="w-[180px] bg-white/5 border-white/10">
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
            <SelectTrigger className="w-[180px] bg-white/5 border-white/10">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="confirmed">Confirmado</SelectItem>
              <SelectItem value="completed">Concluído</SelectItem>
            </SelectContent>
          </Select>
        </motion.div>
      )}

      {/* Compact Week Selector */}
      <CompactWeekSelector
        selectedDate={date}
        onDateChange={setDate}
        onTodayClick={handleTodayClick}
      />

      {/* Main Content */}
      <div>
        {viewMode === "week" ? (
          <EnhancedWeekView
            selectedDate={date}
            appointments={filteredAppointments}
            allAppointments={allAppointments}
            onSelectDate={setDate}
            onSelectAppointment={setSelectedAppointment}
            onEmptySlotClick={handleEmptySlotClick}
          />
        ) : (
          <PremiumTimeline
            appointments={filteredAppointments.filter(apt => apt.data === format(date, 'yyyy-MM-dd'))}
            selectedDate={date}
            onSelectAppointment={setSelectedAppointment}
            onEmptySlotClick={(time) => handleEmptySlotClick(format(date, 'yyyy-MM-dd'), time)}
          />
        )}
      </div>

      {/* FAB */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
        onClick={() => {
          setSelectedEmptySlot({ date: format(date, 'yyyy-MM-dd'), time: "" });
          setManualBookingModalOpen(true);
        }}
        className={cn(
          "fixed bottom-8 right-8 z-50",
          "w-14 h-14 rounded-full",
          "bg-gradient-to-br from-primary to-primary/80",
          "flex items-center justify-center",
          "shadow-2xl shadow-primary/30",
          "hover:scale-110 active:scale-95",
          "transition-transform duration-200",
          "border border-white/10"
        )}
      >
        <Plus className="w-6 h-6 text-white" />
      </motion.button>

      {/* Modals */}
      <AppointmentDetailsSidebar
        appointment={selectedAppointment}
        open={!!selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
        onUpdate={() => loadAppointments(date)}
      />

      <ConfirmAttendanceModal
        appointment={confirmModalAppointment}
        open={!!confirmModalAppointment}
        onClose={() => setConfirmModalAppointment(null)}
        onUpdate={() => loadAppointments(date)}
      />

      <MobileManualBookingModal
        open={manualBookingModalOpen}
        onOpenChange={setManualBookingModalOpen}
        date={selectedEmptySlot.date}
        initialTime={selectedEmptySlot.time}
        onSuccess={() => loadAppointments(date)}
      />
    </div>
  );
}