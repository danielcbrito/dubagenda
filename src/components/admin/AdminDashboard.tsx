import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Calendar, DollarSign, Users, TrendingUp, Scissors, Clock, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Stats {
  todayAppointments: number;
  monthRevenue: number;
  activeClients: number;
  pendingPayments: number;
  totalCutsMonth: number;
  pendingAppointments: number;
}

interface RecentAppointment {
  id: string;
  data: string;
  hora: string;
  status: string;
  preco: number;
  profile: { nome: string } | null;
  servico: { nome: string } | null;
}

const StatCard = ({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend, 
  trendValue,
  variant = "default" 
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: any;
  trend?: "up" | "down";
  trendValue?: string;
  variant?: "default" | "gold" | "warning" | "danger";
}) => {
  const iconBgClass = {
    default: "bg-gradient-primary shadow-glow-red",
    gold: "bg-gradient-gold shadow-glow-gold",
    warning: "bg-gradient-to-br from-amber-500 to-orange-600",
    danger: "bg-gradient-to-br from-red-500 to-rose-600",
  }[variant];

  const valueColorClass = {
    default: "text-foreground",
    gold: "text-gold",
    warning: "text-amber-400",
    danger: "text-orange-400",
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
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">{subtitle}</p>
            {trend && trendValue && (
              <span className={cn(
                "flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full",
                trend === "up" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
              )}>
                {trend === "up" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {trendValue}
              </span>
            )}
          </div>
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
    monthRevenue: 0,
    activeClients: 0,
    pendingPayments: 0,
    totalCutsMonth: 0,
    pendingAppointments: 0,
  });
  const [recentAppointments, setRecentAppointments] = useState<RecentAppointment[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
    
    const appointmentsChannel = supabase
      .channel('dashboard-appointments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' }, () => {
        loadDashboardData();
      })
      .subscribe();

    const paymentsChannel = supabase
      .channel('dashboard-payments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagamentos' }, () => {
        loadDashboardData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(appointmentsChannel);
      supabase.removeChannel(paymentsChannel);
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const firstDayOfMonth = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');

      const { count: todayCount } = await supabase
        .from("agendamentos")
        .select("*", { count: "exact", head: true })
        .eq("data", today);

      const { data: monthPayments } = await supabase
        .from("pagamentos")
        .select("valor")
        .gte("created_at", firstDayOfMonth)
        .eq("status", "paid");

      const monthRevenue = monthPayments?.reduce((sum, p) => sum + Number(p.valor), 0) || 0;

      const { count: clientsCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("blocked", false);

      const { count: pendingCount } = await supabase
        .from("pagamentos")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      const { count: cutsCount } = await supabase
        .from("agendamentos")
        .select("*", { count: "exact", head: true })
        .gte("data", firstDayOfMonth)
        .in("status", ["confirmed", "completed"]);

      const { count: pendingAppointments } = await supabase
        .from("agendamentos")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      const { data: appointments } = await supabase
        .from("agendamentos")
        .select("id, data, hora, status, preco, user_id, servico_id")
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

      const monthsData = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString();

        const { data: monthData } = await supabase
          .from("pagamentos")
          .select("valor")
          .gte("created_at", firstDay)
          .lte("created_at", lastDay)
          .eq("status", "paid");

        const total = monthData?.reduce((sum, p) => sum + Number(p.valor), 0) || 0;
        monthsData.push({
          month: date.toLocaleDateString('pt-BR', { month: 'short' }),
          receita: total
        });
      }

      setStats({
        todayAppointments: todayCount || 0,
        monthRevenue,
        activeClients: clientsCount || 0,
        pendingPayments: pendingCount || 0,
        totalCutsMonth: cutsCount || 0,
        pendingAppointments: pendingAppointments || 0,
      });

      setRecentAppointments(appointmentsWithDetails);
      setRevenueData(monthsData);
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map(i => (
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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <StatCard
          title="Hoje"
          value={stats.todayAppointments}
          subtitle="Agendamentos"
          icon={Calendar}
          trend="up"
          trendValue="+12%"
        />
        <StatCard
          title="Receita do Mês"
          value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.monthRevenue)}
          subtitle="Faturamento"
          icon={DollarSign}
          variant="gold"
          trend="up"
          trendValue="+8%"
        />
        <StatCard
          title="Clientes"
          value={stats.activeClients}
          subtitle="Ativos"
          icon={Users}
        />
        <StatCard
          title="Pagamentos"
          value={stats.pendingPayments}
          subtitle="Pendentes"
          icon={TrendingUp}
          variant="warning"
        />
        <StatCard
          title="Cortes do Mês"
          value={stats.totalCutsMonth}
          subtitle="Realizados"
          icon={Scissors}
        />
        <StatCard
          title="Confirmações"
          value={stats.pendingAppointments}
          subtitle="Aguardando"
          icon={Clock}
          variant="danger"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <Card className="glass-card p-6 hover-elevate">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow-red">
              <TrendingUp className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <div>
              <h3 className="font-bold text-lg">Evolução de Receita</h3>
              <p className="text-xs text-muted-foreground">Últimos 6 meses</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
              <XAxis 
                dataKey="month" 
                stroke="hsl(var(--muted-foreground))" 
                style={{ fontSize: '11px', fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))" 
                style={{ fontSize: '11px', fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `R$${value/1000}k`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '12px',
                  backdropFilter: 'blur(12px)',
                  padding: '12px 16px',
                  boxShadow: 'var(--shadow-premium)',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600, marginBottom: 4 }}
                formatter={(value: number) => [new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value), 'Receita']}
              />
              <Area 
                type="monotone" 
                dataKey="receita" 
                stroke="hsl(var(--primary))" 
                strokeWidth={3}
                fill="url(#colorReceita)"
                dot={{ fill: 'hsl(var(--primary))', r: 4, strokeWidth: 2, stroke: 'hsl(var(--background))' }}
                activeDot={{ r: 6, fill: 'hsl(var(--primary))', filter: 'drop-shadow(0 0 8px hsl(var(--primary)))' }}
              />
            </AreaChart>
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
                  <span className="font-bold text-sm price-gold">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(apt.preco))}
                  </span>
                  {getStatusBadge(apt.status)}
                </div>
              </div>
            ))}
            
            {recentAppointments.length === 0 && (
              <div className="text-center py-12">
                <Calendar className="w-16 h-16 mx-auto mb-4 text-muted-foreground/20" strokeWidth={1} />
                <p className="text-muted-foreground text-sm">Nenhum agendamento recente</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
