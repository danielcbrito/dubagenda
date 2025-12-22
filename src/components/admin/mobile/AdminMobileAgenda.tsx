import { useState, useEffect, useCallback } from "react";
import { format, addDays, subDays, isToday, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  Clock, 
  User, 
  Scissors, 
  CheckCircle, 
  AlertCircle, 
  Phone,
  Plus,
  RefreshCw,
  CreditCard,
  Crown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface MobileAppointment {
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
  profile: { nome: string; telefone?: string } | null;
  servico: { nome: string; duracao_minutos: number } | null;
}

interface AdminMobileAgendaProps {
  onAppointmentClick?: (appointment: MobileAppointment) => void;
  onAddClick?: (date: string, time: string) => void;
}

const getStatusConfig = (status: string, barbeiroConfirmou: boolean | null) => {
  if (status === "completed") {
    return { 
      color: "bg-emerald-500", 
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/30",
      textColor: "text-emerald-400",
      label: "Concluído",
      icon: CheckCircle
    };
  }
  if (status === "confirmed" || barbeiroConfirmou) {
    return { 
      color: "bg-sky-500", 
      bgColor: "bg-sky-500/10",
      borderColor: "border-sky-500/30",
      textColor: "text-sky-400",
      label: "Confirmado",
      icon: CheckCircle
    };
  }
  return { 
    color: "bg-amber-500", 
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    textColor: "text-amber-400",
    label: "Pendente",
    icon: AlertCircle
  };
};

const getServiceColor = (serviceName: string | undefined) => {
  if (!serviceName) return "from-zinc-600 to-zinc-700";
  const name = serviceName.toLowerCase();
  if (name.includes("corte") && name.includes("barba")) return "from-violet-600 to-purple-700";
  if (name.includes("corte")) return "from-sky-600 to-blue-700";
  if (name.includes("barba")) return "from-amber-600 to-orange-700";
  if (name.includes("sobrancelha")) return "from-rose-600 to-pink-700";
  return "from-primary to-red-700";
};

export function AdminMobileAgenda({ onAppointmentClick, onAddClick }: AdminMobileAgendaProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [appointments, setAppointments] = useState<MobileAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Gerar dias da semana para o seletor horizontal
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(new Date(), i - 3);
    return date;
  });

  const loadAppointments = useCallback(async (date: Date, silent = false) => {
    try {
      if (!silent) setLoading(true);
      
      const dateStr = format(date, 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from("agendamentos")
        .select("*")
        .eq("data", dateStr)
        .in("status", ["pending", "confirmed", "completed"])
        .order("hora", { ascending: true });

      if (error) throw error;

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
      console.error("Error loading appointments:", error);
      if (!silent) toast.error("Erro ao carregar agendamentos");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAppointments(selectedDate);

    // Real-time subscription
    const channel = supabase
      .channel('mobile-agenda-updates')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'agendamentos' 
      }, () => {
        loadAppointments(selectedDate, true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate, loadAppointments]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadAppointments(selectedDate);
  };

  const handlePrevDay = () => {
    setSelectedDate(prev => subDays(prev, 1));
  };

  const handleNextDay = () => {
    setSelectedDate(prev => addDays(prev, 1));
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  const handleCall = (phone: string | undefined) => {
    if (phone) {
      window.open(`tel:${phone}`, '_self');
    }
  };

  const pendingCount = appointments.filter(a => a.status === 'pending' && !a.barbeiro_confirmou).length;
  const confirmedCount = appointments.filter(a => a.status === 'confirmed' || a.barbeiro_confirmou).length;
  const completedCount = appointments.filter(a => a.status === 'completed').length;

  return (
    <div className="flex flex-col h-full pb-20">
      {/* Header com data e navegação */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-xl border-b border-border/30 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevDay}
              className="w-9 h-9 rounded-xl bg-secondary/50 flex items-center justify-center active:scale-95 transition-transform"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="text-center">
              <div className="text-lg font-bold">
                {format(selectedDate, "d 'de' MMMM", { locale: ptBR })}
              </div>
              <div className="text-xs text-muted-foreground">
                {format(selectedDate, "EEEE", { locale: ptBR })}
              </div>
            </div>
            
            <button
              onClick={handleNextDay}
              className="w-9 h-9 rounded-xl bg-secondary/50 flex items-center justify-center active:scale-95 transition-transform"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {!isToday(selectedDate) && (
              <button
                onClick={handleToday}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/10 text-primary active:scale-95 transition-transform"
              >
                Hoje
              </button>
            )}
            <button
              onClick={handleRefresh}
              className={cn(
                "w-9 h-9 rounded-xl bg-secondary/50 flex items-center justify-center active:scale-95 transition-all",
                refreshing && "animate-spin"
              )}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Seletor de dias horizontal */}
        <ScrollArea className="w-full"  type="scroll">
          <div className="flex gap-2 pb-2">
            {weekDays.map((day) => {
              const isSelected = isSameDay(day, selectedDate);
              const dayIsToday = isToday(day);
              
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "flex-shrink-0 flex flex-col items-center justify-center w-12 h-14 rounded-xl transition-all active:scale-95",
                    isSelected 
                      ? "bg-primary text-primary-foreground shadow-glow-red" 
                      : "bg-secondary/30 hover:bg-secondary/50",
                    dayIsToday && !isSelected && "ring-1 ring-primary/50"
                  )}
                >
                  <span className={cn(
                    "text-[10px] font-medium uppercase",
                    isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                  )}>
                    {format(day, "EEE", { locale: ptBR })}
                  </span>
                  <span className={cn(
                    "text-lg font-bold",
                    isSelected ? "text-primary-foreground" : "text-foreground"
                  )}>
                    {format(day, "d")}
                  </span>
                </button>
              );
            })}
          </div>
        </ScrollArea>

        {/* Resumo rápido */}
        <div className="flex gap-2 mt-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-xs font-medium text-amber-400">{pendingCount} pendentes</span>
          </div>
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-sky-500/10 border border-sky-500/20">
            <div className="w-2 h-2 rounded-full bg-sky-500" />
            <span className="text-xs font-medium text-sky-400">{confirmedCount} confirmados</span>
          </div>
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-medium text-emerald-400">{completedCount} feitos</span>
          </div>
        </div>
      </div>

      {/* Lista de agendamentos */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : appointments.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-40 text-center"
          >
            <Calendar className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-medium">Nenhum agendamento</p>
            <p className="text-sm text-muted-foreground/70">
              {isToday(selectedDate) ? "Dia livre hoje!" : "Sem compromissos neste dia"}
            </p>
            {onAddClick && (
              <button
                onClick={() => onAddClick(format(selectedDate, 'yyyy-MM-dd'), '09:00')}
                className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium active:scale-95 transition-transform"
              >
                <Plus className="w-4 h-4" />
                Adicionar horário
              </button>
            )}
          </motion.div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {appointments.map((apt, index) => {
                const statusConfig = getStatusConfig(apt.status, apt.barbeiro_confirmou);
                const serviceGradient = getServiceColor(apt.servico?.nome);
                const StatusIcon = statusConfig.icon;
                const isPlan = apt.tipo_agendamento === 'plano';
                const isFree = apt.is_free;
                const isCredit = apt.payment_method === 'credit' || apt.observacoes?.includes('crédito');

                return (
                  <motion.div
                    key={apt.id}
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => onAppointmentClick?.(apt)}
                    className={cn(
                      "relative overflow-hidden rounded-2xl border transition-all active:scale-[0.98]",
                      statusConfig.borderColor,
                      statusConfig.bgColor
                    )}
                  >
                    {/* Gradient bar */}
                    <div className={cn(
                      "absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b",
                      serviceGradient
                    )} />

                    <div className="pl-4 pr-3 py-3">
                      {/* Header: Horário + Status */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background/50">
                            <Clock className="w-3.5 h-3.5 text-primary" />
                            <span className="text-sm font-bold tabular-nums">{apt.hora}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {apt.servico?.duracao_minutos}min
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {isPlan && (
                            <Badge className="h-5 px-1.5 bg-gold/20 text-gold border-0 text-[10px]">
                              <Crown className="w-3 h-3 mr-0.5" />
                              PLANO
                            </Badge>
                          )}
                          {(isFree || isCredit) && (
                            <Badge className="h-5 px-1.5 bg-purple-500/20 text-purple-400 border-0 text-[10px]">
                              <CreditCard className="w-3 h-3 mr-0.5" />
                              {isFree ? "GRÁTIS" : "CRÉDITO"}
                            </Badge>
                          )}
                          <div className={cn(
                            "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
                            statusConfig.bgColor,
                            statusConfig.textColor
                          )}>
                            <StatusIcon className="w-3 h-3" />
                            {statusConfig.label}
                          </div>
                        </div>
                      </div>

                      {/* Serviço */}
                      <div className="flex items-center gap-2 mb-2">
                        <Scissors className="w-4 h-4 text-primary" />
                        <span className="font-semibold">{apt.servico?.nome || "Serviço"}</span>
                      </div>

                      {/* Cliente */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {apt.profile?.nome || "Cliente"}
                          </span>
                        </div>

                        {/* Ações rápidas */}
                        <div className="flex items-center gap-2">
                          {apt.profile?.telefone && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCall(apt.profile?.telefone);
                              }}
                              className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center active:scale-95 transition-transform"
                            >
                              <Phone className="w-4 h-4 text-emerald-400" />
                            </button>
                          )}
                          <div className="text-right">
                            <span className={cn(
                              "text-sm font-bold",
                              isFree ? "text-purple-400 line-through" : "text-foreground"
                            )}>
                              R$ {apt.preco.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Observações */}
                      {apt.observacoes && !apt.observacoes.includes('crédito') && (
                        <div className="mt-2 px-2 py-1.5 rounded-lg bg-background/30 text-xs text-muted-foreground">
                          📝 {apt.observacoes}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* FAB para adicionar */}
      {onAddClick && (
        <button
          onClick={() => onAddClick(format(selectedDate, 'yyyy-MM-dd'), '09:00')}
          className={cn(
            "fixed bottom-24 right-4 z-30 w-14 h-14 rounded-full",
            "bg-gradient-to-br from-primary to-primary/80",
            "flex items-center justify-center",
            "shadow-glow-red",
            "active:scale-95 transition-transform"
          )}
        >
          <Plus className="w-6 h-6 text-primary-foreground" />
        </button>
      )}
    </div>
  );
}
