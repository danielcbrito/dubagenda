import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Calendar, DollarSign, Users, TrendingUp, Scissors, Clock } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

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
    
    // Real-time subscriptions
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
      const today = new Date().toISOString().split('T')[0];
      const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

      // Today's appointments
      const { count: todayCount } = await supabase
        .from("agendamentos")
        .select("*", { count: "exact", head: true })
        .eq("data", today);

      // Month revenue
      const { data: monthPayments } = await supabase
        .from("pagamentos")
        .select("valor")
        .gte("created_at", firstDayOfMonth)
        .eq("status", "paid");

      const monthRevenue = monthPayments?.reduce((sum, p) => sum + Number(p.valor), 0) || 0;

      // Active clients
      const { count: clientsCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("blocked", false);

      // Pending payments
      const { count: pendingCount } = await supabase
        .from("pagamentos")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      // Total cuts this month
      const { count: cutsCount } = await supabase
        .from("agendamentos")
        .select("*", { count: "exact", head: true })
        .gte("data", firstDayOfMonth)
        .in("status", ["confirmed", "completed"]);

      // Pending appointments
      const { count: pendingAppointments } = await supabase
        .from("agendamentos")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      // Recent appointments
      const { data: appointments } = await supabase
        .from("agendamentos")
        .select("id, data, hora, status, preco, user_id, servico_id")
        .order("data", { ascending: false })
        .order("hora", { ascending: false })
        .limit(5);

      // Get profile and service details for appointments
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

      // Revenue chart data (last 6 months)
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
    const badges = {
      pending: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
      confirmed: "bg-green-500/20 text-green-300 border-green-500/30",
      completed: "bg-blue-500/20 text-blue-300 border-blue-500/30",
      cancelled_by_admin: "bg-red-500/20 text-red-300 border-red-500/30",
      cancelled_by_user: "bg-red-500/20 text-red-300 border-red-500/30",
      no_show: "bg-gray-500/20 text-gray-300 border-gray-500/30",
    };
    const labels = {
      pending: "Pendente",
      confirmed: "Confirmado",
      completed: "Concluído",
      cancelled_by_admin: "Cancelado",
      cancelled_by_user: "Cancelado",
      no_show: "Não Compareceu",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs border ${badges[status as keyof typeof badges] || badges.pending}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-widest mb-2">DASHBOARD</h1>
        <p className="text-muted-foreground text-sm tracking-wide">Visão geral do seu negócio premium</p>
      </div>

      {/* Stats Grid Ultra Premium */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="stat-card hover-elevate glow-red">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground tracking-widest uppercase mb-2">Hoje</p>
              <p className="text-4xl font-bold tracking-wide">{stats.todayAppointments}</p>
              <p className="text-sm text-muted-foreground mt-1">Agendamentos</p>
            </div>
            <div className="stat-card-icon">
              <Calendar className="w-6 h-6 text-primary-foreground" strokeWidth={2.5} />
            </div>
          </div>
        </div>

        <div className="stat-card hover-elevate glow-red">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground tracking-widest uppercase mb-2">Mês</p>
              <p className="text-4xl font-bold tracking-wide">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.monthRevenue)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Receita</p>
            </div>
            <div className="stat-card-icon gold">
              <DollarSign className="w-6 h-6 text-gold-foreground" strokeWidth={2.5} />
            </div>
          </div>
        </div>

        <div className="stat-card hover-elevate glow-red">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground tracking-widest uppercase mb-2">Total</p>
              <p className="text-4xl font-bold tracking-wide">{stats.activeClients}</p>
              <p className="text-sm text-muted-foreground mt-1">Clientes Ativos</p>
            </div>
            <div className="stat-card-icon">
              <Users className="w-6 h-6 text-primary-foreground" strokeWidth={2.5} />
            </div>
          </div>
        </div>

        <div className="stat-card hover-elevate glow-red">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground tracking-widest uppercase mb-2">Pendente</p>
              <p className="text-4xl font-bold tracking-wide text-yellow-400">{stats.pendingPayments}</p>
              <p className="text-sm text-muted-foreground mt-1">Pagamentos</p>
            </div>
            <div className="stat-card-icon" style={{background: 'linear-gradient(135deg, hsl(45 100% 51%), hsl(38 100% 50%))'}}>
              <TrendingUp className="w-6 h-6 text-gold-foreground" strokeWidth={2.5} />
            </div>
          </div>
        </div>

        <div className="stat-card hover-elevate glow-red">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground tracking-widest uppercase mb-2">Mês</p>
              <p className="text-4xl font-bold tracking-wide">{stats.totalCutsMonth}</p>
              <p className="text-sm text-muted-foreground mt-1">Cortes Realizados</p>
            </div>
            <div className="stat-card-icon">
              <Scissors className="w-6 h-6 text-primary-foreground" strokeWidth={2.5} />
            </div>
          </div>
        </div>

        <div className="stat-card hover-elevate glow-red">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground tracking-widest uppercase mb-2">Aguardando</p>
              <p className="text-4xl font-bold tracking-wide text-orange-400">{stats.pendingAppointments}</p>
              <p className="text-sm text-muted-foreground mt-1">Confirmações</p>
            </div>
            <div className="stat-card-icon">
              <Clock className="w-6 h-6 text-primary-foreground" strokeWidth={2.5} />
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Chart Premium */}
      <div className="card-glass p-8 hover-elevate">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow-red">
            <TrendingUp className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="font-bold text-xl tracking-wide">Evolução de Receita</h3>
            <p className="text-xs text-muted-foreground tracking-wide">Últimos 6 meses</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis 
              dataKey="month" 
              stroke="hsl(var(--muted-foreground))" 
              style={{ fontSize: '12px', fontWeight: 600 }}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))" 
              style={{ fontSize: '12px', fontWeight: 600 }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '12px',
                backdropFilter: 'blur(12px)',
                padding: '12px',
                boxShadow: 'var(--shadow-premium)',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
            />
            <Line 
              type="monotone" 
              dataKey="receita" 
              stroke="hsl(var(--primary))" 
              strokeWidth={3}
              dot={{ fill: 'hsl(var(--primary))', r: 6, strokeWidth: 2, stroke: 'hsl(var(--background))' }}
              activeDot={{ r: 8, fill: 'hsl(var(--primary))', filter: 'drop-shadow(0 0 8px hsl(var(--primary)))' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Appointments Premium */}
      <div className="card-glass p-8 hover-elevate">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow-red">
            <Calendar className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="font-bold text-xl tracking-wide">Agendamentos Recentes</h3>
            <p className="text-xs text-muted-foreground tracking-wide">Últimas movimentações</p>
          </div>
        </div>
        <div className="space-y-3">
          {recentAppointments.map((apt) => (
            <div
              key={apt.id}
              className="flex items-center justify-between p-5 rounded-xl bg-secondary/30 hover:bg-secondary/50 border border-border/30 hover:border-border-glow transition-all hover-elevate"
            >
              <div className="flex-1">
                <p className="font-semibold text-base tracking-wide">{apt.profile?.nome || "Cliente"}</p>
                <p className="text-sm text-muted-foreground mt-1 tracking-wide">
                  {apt.servico?.nome || "Serviço"} • {new Date(apt.data).toLocaleDateString('pt-BR')} às {apt.hora}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-bold text-lg tracking-wide text-primary">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(apt.preco))}
                </span>
                {getStatusBadge(apt.status)}
              </div>
            </div>
          ))}
          
          {recentAppointments.length === 0 && (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" strokeWidth={1.5} />
              <p className="text-muted-foreground tracking-wide">Nenhum agendamento recente</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
