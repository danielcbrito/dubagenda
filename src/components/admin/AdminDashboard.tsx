import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Calendar, Users, Scissors, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Stats {
  todayAppointments: number;
  activeClients: number;
  totalCutsMonth: number;
  pendingAppointments: number;
}

interface RecentAppointment {
  id: string;
  data: string;
  hora: string;
  status: string;
  profile: { nome: string } | null;
  servico: { nome: string } | null;
}

const StatCard = ({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  variant = "default" 
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: any;
  variant?: "default" | "gold" | "warning";
}) => {
  const iconBgClass = {
    default: "bg-gradient-primary shadow-glow-red",
    gold: "bg-gradient-gold shadow-glow-gold",
    warning: "bg-gradient-to-br from-amber-500 to-orange-600",
  }[variant];

  const valueColorClass = {
    default: "text-foreground",
    gold: "text-gold",
    warning: "text-amber-400",
  }[variant];

  return (
    <div className="stat-card hover-elevate group">
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-[11px] text-muted-foreground tracking-[0.15em] uppercase font-semibold">
            {title}
          </p>
          <p className={cn("text-4xl font-bold tracking-tight", valueColorClass)}>
            {value}
          </p>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className={cn("stat-card-icon", iconBgClass)}>
          <Icon className="w-6 h-6 text-white" strokeWidth={2} />
        </div>
      </div>
    </div>
  );
};

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    todayAppointments: 0,
    activeClients: 0,
    totalCutsMonth: 0,
    pendingAppointments: 0,
  });
  const [recentAppointments, setRecentAppointments] = useState<RecentAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
    
    const appointmentsChannel = supabase
      .channel('dashboard-appointments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' }, () => {
        loadDashboardData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(appointmentsChannel);
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const firstDayOfMonth = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');

      // Agendamentos de hoje
      const { count: todayCount } = await supabase
        .from("agendamentos")
        .select("*", { count: "exact", head: true })
        .eq("data", today);

      // Clientes ativos
      const { count: clientsCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("blocked", false);

      // Cortes do mês (confirmados + completados)
      const { count: cutsCount } = await supabase
        .from("agendamentos")
        .select("*", { count: "exact", head: true })
        .gte("data", firstDayOfMonth)
        .in("status", ["confirmed", "completed"]);

      // Confirmações pendentes
      const { count: pendingAppointments } = await supabase
        .from("agendamentos")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      // Agendamentos recentes (sem preco)
      const { data: appointments } = await supabase
        .from("agendamentos")
        .select("id, data, hora, status, user_id, servico_id")
        .order("data", { ascending: false })
        .order("hora", { ascending: false })
        .limit(5);

      const appointmentsWithDetails = await Promise.all(
        (appointments || []).map(async (apt) => {
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

      setStats({
        todayAppointments: todayCount || 0,
        activeClients: clientsCount || 0,
        totalCutsMonth: cutsCount || 0,
        pendingAppointments: pendingAppointments || 0,
      });

      setRecentAppointments(appointmentsWithDetails);
      setLoading(false);
    } catch (error) {
      console.error("Error loading dashboard:", error);
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config = {
      pending: { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/30", label: "Pendente" },
      confirmed: { bg: "bg-green-500/15", text: "text-green-400", border: "border-green-500/30", label: "Confirmado" },
      completed: { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/30", label: "Concluído" },
      cancelled_by_admin: { bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/30", label: "Cancelado" },
      cancelled_by_user: { bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/30", label: "Cancelado" },
      no_show: { bg: "bg-gray-500/15", text: "text-gray-400", border: "border-gray-500/30", label: "Não Compareceu" },
    };
    const statusConfig = config[status as keyof typeof config] || config.pending;
    
    return (
      <span className={cn(
        "px-3 py-1.5 rounded-full text-xs font-semibold border",
        statusConfig.bg, statusConfig.text, statusConfig.border
      )}>
        {statusConfig.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Visão geral do seu negócio • {format(new Date(), "dd 'de' MMMM, yyyy")}</p>
        </div>
      </div>

      {/* Stats Grid - 4 cards organizados */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Hoje"
          value={stats.todayAppointments}
          subtitle="Agendamentos"
          icon={Calendar}
        />
        <StatCard
          title="Clientes"
          value={stats.activeClients}
          subtitle="Ativos"
          icon={Users}
        />
        <StatCard
          title="Cortes do Mês"
          value={stats.totalCutsMonth}
          subtitle="Realizados"
          icon={Scissors}
          variant="gold"
        />
        <StatCard
          title="Confirmações"
          value={stats.pendingAppointments}
          subtitle="Aguardando"
          icon={Clock}
          variant="warning"
        />
      </div>

      {/* Recent Appointments - Full Width */}
      <Card className="glass-card p-6 hover-elevate">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow-red">
            <Calendar className="w-5 h-5 text-white" strokeWidth={2} />
          </div>
          <div>
            <h3 className="font-bold text-lg">Agendamentos Recentes</h3>
            <p className="text-xs text-muted-foreground">Últimas movimentações</p>
          </div>
        </div>
        <div className="space-y-3">
          {recentAppointments.map((apt, index) => (
            <div
              key={apt.id}
              className={cn(
                "flex items-center justify-between p-4 rounded-xl",
                "bg-secondary/40 hover:bg-secondary/60",
                "border border-border/30 hover:border-border/50",
                "transition-all duration-200 hover:-translate-y-0.5",
                "animate-fade-in"
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center border border-primary/20">
                  <span className="text-sm font-bold text-primary">
                    {apt.profile?.nome?.charAt(0) || "?"}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-sm">{apt.profile?.nome || "Cliente"}</p>
                  <p className="text-xs text-muted-foreground">
                    {apt.servico?.nome || "Serviço"} • {new Date(`${apt.data}T12:00:00`).toLocaleDateString('pt-BR')} às {apt.hora}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {getStatusBadge(apt.status)}
              </div>
            </div>
          ))}
          
          {recentAppointments.length === 0 && (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhum agendamento recente</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
