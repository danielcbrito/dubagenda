import { useState, useEffect, useCallback, useRef } from "react";
import { format, addMinutes, parse, isAfter, isBefore, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, 
  Clock, 
  User, 
  Scissors, 
  CheckCircle, 
  AlertCircle,
  Coffee,
  X,
  Crown,
  CreditCard
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useBarberBusinessHours } from "@/hooks/useBarberBusinessHours";

interface TimelineAppointment {
  id: string;
  data: string;
  hora: string;
  status: string;
  preco: number;
  observacoes: string | null;
  barbeiro_confirmou: boolean | null;
  is_free: boolean | null;
  payment_method: string | null;
  tipo_agendamento: string | null;
  user_id: string;
  servico_id: string;
  duracao: number;
  profile: { nome: string; telefone?: string } | null;
  servico: { nome: string; duracao_minutos: number } | null;
}

interface MobileDayTimelineProps {
  selectedDate: Date;
  onSlotClick: (time: string) => void;
  onAppointmentClick: (appointment: TimelineAppointment) => void;
  barbeiroId?: string | null;
}

const SLOT_HEIGHT = 60;
const SLOT_INTERVAL = 30;

const getStatusConfig = (status: string, barbeiroConfirmou: boolean | null) => {
  if (status === "completed") {
    return { 
      color: "bg-emerald-500", 
      gradient: "from-emerald-600 to-emerald-700",
      label: "Concluído",
      icon: CheckCircle
    };
  }
  if (status === "confirmed" || barbeiroConfirmou) {
    return { 
      color: "bg-sky-500", 
      gradient: "from-sky-600 to-blue-700",
      label: "Confirmado",
      icon: CheckCircle
    };
  }
  return { 
    color: "bg-amber-500", 
    gradient: "from-amber-600 to-orange-700",
    label: "Pendente",
    icon: AlertCircle
  };
};

export function MobileDayTimeline({ selectedDate, onSlotClick, onAppointmentClick, barbeiroId }: MobileDayTimelineProps) {
  const [appointments, setAppointments] = useState<TimelineAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentTimeRef = useRef<HTMLDivElement>(null);

  // Usar hook centralizado com hierarquia de prioridade por barbeiro
  const { config: horarioConfig, loading: loadingConfig } = useBarberBusinessHours(selectedDate, barbeiroId || null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      // Carregar agendamentos filtrados por barbeiro
      let query = supabase
        .from("agendamentos")
        .select("*")
        .eq("data", dateStr)
        .in("status", ["pending", "confirmed", "completed"])
        .order("hora", { ascending: true });

      // FILTRO CRÍTICO: Se barbeiro, mostrar APENAS seus agendamentos
      if (barbeiroId) {
        query = query.eq("barbeiro_id", barbeiroId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Carregar detalhes dos agendamentos
      const appointmentsWithDetails = await Promise.all(
        (data || []).map(async (apt) => {
          const [profileRes, servicoRes] = await Promise.all([
            supabase.from("profiles").select("nome, telefone").eq("id", apt.user_id).maybeSingle(),
            supabase.from("servicos").select("nome, duracao_minutos").eq("id", apt.servico_id).maybeSingle(),
          ]);

          return {
            ...apt,
            profile: profileRes.data || null,
            servico: servicoRes.data || null,
          };
        })
      );

      setAppointments(appointmentsWithDetails);
    } catch (error) {
      console.error("Error loading timeline data:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, barbeiroId]);

  useEffect(() => {
    loadData();

    // Real-time subscription
    const channel = supabase
      .channel('mobile-timeline-updates')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'agendamentos' 
      }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  // Scroll para horário atual ao carregar
  useEffect(() => {
    if (!loading && currentTimeRef.current && isSameDay(selectedDate, new Date())) {
      setTimeout(() => {
        currentTimeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [loading, selectedDate]);

  // Gerar slots de tempo
  const generateTimeSlots = () => {
    if (!horarioConfig) return [];
    
    const slots: { time: string; isLunch: boolean }[] = [];
    const [startH, startM] = horarioConfig.hora_abertura.split(":").map(Number);
    const [endH, endM] = horarioConfig.hora_fechamento.split(":").map(Number);
    
    let current = new Date();
    current.setHours(startH, startM, 0, 0);
    
    const end = new Date();
    end.setHours(endH, endM, 0, 0);

    let lunchStart: Date | null = null;
    let lunchEnd: Date | null = null;
    
    if (horarioConfig.hora_almoco_inicio && horarioConfig.hora_almoco_fim) {
      const [lsH, lsM] = horarioConfig.hora_almoco_inicio.split(":").map(Number);
      const [leH, leM] = horarioConfig.hora_almoco_fim.split(":").map(Number);
      lunchStart = new Date();
      lunchStart.setHours(lsH, lsM, 0, 0);
      lunchEnd = new Date();
      lunchEnd.setHours(leH, leM, 0, 0);
    }

    while (isBefore(current, end) || current.getTime() === end.getTime()) {
      const timeStr = format(current, "HH:mm");
      const isLunch = lunchStart && lunchEnd && 
        (isAfter(current, lunchStart) || current.getTime() === lunchStart.getTime()) && 
        isBefore(current, lunchEnd);
      
      slots.push({ time: timeStr, isLunch: Boolean(isLunch) });
      current = addMinutes(current, SLOT_INTERVAL);
    }

    return slots;
  };

  // Verificar se um slot está ocupado
  const getAppointmentForSlot = (time: string): TimelineAppointment | null => {
    return appointments.find(apt => {
      const aptStart = apt.hora.substring(0, 5);
      const [h, m] = aptStart.split(":").map(Number);
      const aptStartDate = new Date();
      aptStartDate.setHours(h, m, 0, 0);
      
      const aptEndDate = addMinutes(aptStartDate, apt.duracao || apt.servico?.duracao_minutos || 30);
      
      const [slotH, slotM] = time.split(":").map(Number);
      const slotDate = new Date();
      slotDate.setHours(slotH, slotM, 0, 0);
      
      return (isAfter(slotDate, aptStartDate) || slotDate.getTime() === aptStartDate.getTime()) && 
             isBefore(slotDate, aptEndDate);
    }) || null;
  };

  // Verificar se é o primeiro slot de um agendamento
  const isFirstSlotOfAppointment = (time: string): TimelineAppointment | null => {
    return appointments.find(apt => apt.hora.substring(0, 5) === time) || null;
  };

  const timeSlots = generateTimeSlots();

  // Calcular posição do indicador de hora atual
  const getCurrentTimePosition = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    if (!horarioConfig) return null;
    
    const [startH, startM] = horarioConfig.hora_abertura.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    const currentMinutes = hours * 60 + minutes;
    
    const slotIndex = (currentMinutes - startMinutes) / SLOT_INTERVAL;
    return slotIndex * SLOT_HEIGHT;
  };

  if (loading || loadingConfig) {
    return (
      <div className="flex items-center justify-center h-60">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!horarioConfig?.aberto) {
    return (
      <div className="flex flex-col items-center justify-center h-60 text-center px-4">
        <X className="w-12 h-12 text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground font-medium">Fechado neste dia</p>
      </div>
    );
  }

  const currentTimePosition = getCurrentTimePosition();
  const isToday = isSameDay(selectedDate, new Date());

  return (
    <div 
      ref={scrollRef}
      className="relative overflow-y-auto h-full"
    >
      {/* Indicador de hora atual */}
      {isToday && currentTimePosition !== null && currentTimePosition >= 0 && (
        <div 
          ref={currentTimeRef}
          className="absolute left-0 right-0 z-20 pointer-events-none"
          style={{ top: currentTimePosition }}
        >
          <div className="relative flex items-center">
            <div className="w-3 h-3 rounded-full bg-primary shadow-glow-red" />
            <div className="flex-1 h-0.5 bg-primary/80" />
            <div className="absolute left-4 -top-2.5 px-2 py-0.5 rounded bg-primary text-[10px] font-bold text-primary-foreground">
              {format(new Date(), "HH:mm")}
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="relative pl-16 pr-4">
        {timeSlots.map(({ time, isLunch }, index) => {
          const appointmentStart = isFirstSlotOfAppointment(time);
          const appointmentInSlot = getAppointmentForSlot(time);
          const isOccupied = appointmentInSlot !== null;
          const isFirstSlot = appointmentStart !== null;

          // Calcular altura do card baseado na duração
          const duration = appointmentStart?.duracao || appointmentStart?.servico?.duracao_minutos || 30;
          const cardHeight = (duration / SLOT_INTERVAL) * SLOT_HEIGHT;

          // Hide lunch slots completely
          if (isLunch && !isOccupied) {
            return null;
          }

          return (
            <div key={time} className="relative" style={{ height: SLOT_HEIGHT }}>
              {/* Marcador de tempo */}
              <div className="absolute left-0 -translate-x-full pr-3 flex items-center h-full">
                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                  {time}
                </span>
              </div>

              {/* Linha de grade */}
              <div className="absolute left-0 right-0 top-0 border-t border-border/30" />

              {/* Lunch slots completely hidden */}

              {/* Card do agendamento (apenas no primeiro slot) */}
              {isFirstSlot && appointmentStart && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={() => onAppointmentClick(appointmentStart)}
                  className="absolute inset-x-0 top-1 z-10 mx-1"
                  style={{ height: cardHeight - 8 }}
                >
                  {(() => {
                    const statusConfig = getStatusConfig(appointmentStart.status, appointmentStart.barbeiro_confirmou);
                    const isPlan = appointmentStart.tipo_agendamento === 'plano';
                    const isFree = appointmentStart.is_free;
                    const StatusIcon = statusConfig.icon;
                    
                    return (
                      <div 
                        className={cn(
                          "h-full rounded-xl overflow-hidden shadow-lg active:scale-[0.98] transition-transform",
                          "bg-gradient-to-br border border-white/10",
                          statusConfig.gradient
                        )}
                      >
                        <div className="h-full p-3 flex flex-col justify-between">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Scissors className="w-3.5 h-3.5 text-white/80 flex-shrink-0" />
                                <span className="text-sm font-semibold text-white truncate">
                                  {appointmentStart.servico?.nome || "Serviço"}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <User className="w-3 h-3 text-white/60 flex-shrink-0" />
                                <span className="text-xs text-white/80 truncate">
                                  {appointmentStart.profile?.nome || "Cliente"}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <StatusIcon className="w-4 h-4 text-white/80" />
                              {isPlan && (
                                <Badge className="h-4 px-1 bg-white/20 text-white border-0 text-[9px]">
                                  <Crown className="w-2.5 h-2.5 mr-0.5" />
                                  PLANO
                                </Badge>
                              )}
                              {isFree && (
                                <Badge className="h-4 px-1 bg-white/20 text-white border-0 text-[9px]">
                                  <CreditCard className="w-2.5 h-2.5 mr-0.5" />
                                  GRÁTIS
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          {cardHeight > 70 && (
                            <div className="flex items-center justify-between mt-auto">
                              <div className="flex items-center gap-1 text-white/60 text-[10px]">
                                <Clock className="w-3 h-3" />
                                {duration}min
                              </div>
                              <span className="text-sm font-bold text-white">
                                R$ {appointmentStart.preco.toFixed(0)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </motion.div>
              )}

              {/* Slot vazio (clicável) */}
              {!isOccupied && !isLunch && (
                <button
                  onClick={() => onSlotClick(time)}
                  className="absolute inset-x-0 top-0 h-full flex items-center justify-center opacity-0 hover:opacity-100 active:opacity-100 transition-opacity group"
                >
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 active:scale-95 transition-transform">
                    <Plus className="w-4 h-4 text-primary" />
                    <span className="text-xs font-medium text-primary">Encaixar às {time}</span>
                  </div>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
