import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Calendar, Users, Scissors, Clock, TrendingUp, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface BarberDashboardProps {
  barbeiroId: string;
}

interface Stats {
  todayAppointments: number;
  todayRevenue: number;
  monthRevenue: number;
  totalCutsMonth: number;
  pendingConfirmation: number;
}

interface DailyRevenue {
  date: string;
  label: string;
  receita: number;
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
  variant?: "default" | "gold" | "warning" | "success";
}) => {
  const iconBgClass = {
    default: "bg-gradient-primary shadow-glow-red",
    gold: "bg-gradient-gold shadow-glow-gold",
    warning: "bg-gradient-to-br from-amber-500 to-orange-600",
    success: "bg-gradient-to-br from-green-500 to-emerald-600",
  }[variant];

  const valueColorClass = {
    default: "text-foreground",
    gold: "text-gold",
    warning: "text-amber-400",
    success: "text-green-400",
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

export function BarberDashboard({ barbeiroId }: BarberDashboardProps) {
  const [stats, setStats] = useState<Stats>({
    todayAppointments: 0,
    todayRevenue: 0,
    monthRevenue: 0,
    totalCutsMonth: 0,
    pendingConfirmation: 0,
  });
  const [recentAppointments, setRecentAppointments] = useState<RecentAppointment[]>([]);
  const [dailyRevenue, setDailyRevenue] = useState<DailyRevenue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
    
    const appointmentsChannel = supabase
      .channel('barber-dashboard-appointments')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'agendamentos',
        filter: `barbeiro_id=eq.${barbeiroId}`
      }, () => {
        loadDashboardData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(appointmentsChannel);
    };
  }, [barbeiroId]);

  const loadDashboardData = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

      // Agendamentos de hoje
      const { data: todayData } = await supabase
        .from("agendamentos")
        .select("preco, status")
        .eq("barbeiro_id", barbeiroId)
        .eq("data", today)
        .in("status", ["pending", "confirmed", "completed"]);

      const todayCount = todayData?.length || 0;
      const todayRevenue = (todayData || [])
        .filter(a => a.status === 'completed')
        .reduce((sum, a) => sum + (a.preco || 0), 0);

      // Cortes do mês - APENAS finalizados
      const { data: monthData } = await supabase
        .from("agendamentos")
        .select("preco")
        .eq("barbeiro_id", barbeiroId)
        .gte("data", monthStart)
        .lte("data", monthEnd)
        .eq("status", "completed");

      const cutsCount = monthData?.length || 0;
      const monthRevenue = (monthData || []).reduce((sum, a) => sum + (a.preco || 0), 0);

      // Confirmações pendentes
      const { count: pendingCount } = await supabase
        .from("agendamentos")
        .select("*", { count: "exact", head: true })
        .eq("barbeiro_id", barbeiroId)
        .eq("status", "pending")
        .eq("barbeiro_confirmou", false);

      // Agendamentos recentes
      const { data: appointments } = await supabase
        .from("agendamentos")
        .select("id, data, hora, status, user_id, servico_id")
        .eq("barbeiro_id", barbeiroId)
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

      // Receita dos últimos 14 dias
      const revenueData: DailyRevenue[] = [];
      for (let i = 13; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const dateStr = format(date, 'yyyy-MM-dd');
        
        const { data: dayAppointments } = await supabase
          .from("agendamentos")
          .select("preco")
          .eq("barbeiro_id", barbeiroId)
          .eq("data", dateStr)
          .eq("status", "completed");

        const dayRevenue = (dayAppointments || []).reduce((sum, apt) => sum + (apt.preco || 0), 0);
        
        revenueData.push({
          date: dateStr,
          label: format(date, 'dd/MM'),
          receita: dayRevenue,
        });
      }

      setStats({
        todayAppointments: todayCount,
        todayRevenue,
        monthRevenue,
        totalCutsMonth: cutsCount,
        pendingConfirmation: pendingCount || 0,
      });

      setRecentAppointments(appointmentsWithDetails);
      setDailyRevenue(revenueData);
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
          <h1 className="text-3xl font-bold tracking-tight mb-1">Meu Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Visão geral do seu desempenho • {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Hoje"
          value={stats.todayAppointments}
          subtitle="Agendamentos"
          icon={Calendar}
        />
        <StatCard
          title="Receita Hoje"
          value={`R$ ${stats.todayRevenue.toFixed(0)}`}
          subtitle="Faturado"
          icon={DollarSign}
          variant="success"
        />
        <StatCard
          title="Cortes do Mês"
          value={stats.totalCutsMonth}
          subtitle={`R$ ${stats.monthRevenue.toFixed(0)}`}
          icon={Scissors}
          variant="gold"
        />
        <StatCard
          title="Confirmações"
          value={stats.pendingConfirmation}
          subtitle="Aguardando"
          icon={Clock}
          variant="warning"
        />
      </div>

      {/* Gráfico de Evolução de Receita */}
      <Card className="glass-card p-6 hover-elevate">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-gold flex items-center justify-center shadow-glow-gold">
            <TrendingUp className="w-5 h-5 text-white" strokeWidth={2} />
          </div>
          <div>
            <h3 className="font-bold text-lg">Evolução de Receita</h3>
            <p className="text-xs text-muted-foreground">Últimos 14 dias</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={dailyRevenue}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis 
              dataKey="label" 
              stroke="hsl(var(--muted-foreground))" 
              fontSize={12}
              tickLine={false}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))" 
              fontSize={12}
              tickLine={false}
              tickFormatter={(value) => `R$${value}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Receita']}
            />
            <Line 
              type="monotone" 
              dataKey="receita" 
              stroke="hsl(var(--primary))" 
              strokeWidth={3}
              dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Recent Appointments */}
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