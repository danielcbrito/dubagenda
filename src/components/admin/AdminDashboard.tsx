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
    <div className="space-y-6 animate-fade-in">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 card-premium hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Agendamentos Hoje</p>
              <p className="text-3xl font-bold mt-2">{stats.todayAppointments}</p>
            </div>
            <Calendar className="w-10 h-10 text-primary" />
          </div>
        </Card>

        <Card className="p-6 card-premium hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Receita do Mês</p>
              <p className="text-3xl font-bold mt-2">
                R$ {stats.monthRevenue.toFixed(2)}
              </p>
            </div>
            <DollarSign className="w-10 h-10 text-primary" />
          </div>
        </Card>

        <Card className="p-6 card-premium hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Clientes Ativos</p>
              <p className="text-3xl font-bold mt-2">{stats.activeClients}</p>
            </div>
            <Users className="w-10 h-10 text-primary" />
          </div>
        </Card>

        <Card className="p-6 card-premium hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pagamentos Pendentes</p>
              <p className="text-3xl font-bold mt-2">{stats.pendingPayments}</p>
            </div>
            <TrendingUp className="w-10 h-10 text-primary" />
          </div>
        </Card>

        <Card className="p-6 card-premium hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Cortes do Mês</p>
              <p className="text-3xl font-bold mt-2">{stats.totalCutsMonth}</p>
            </div>
            <Scissors className="w-10 h-10 text-primary" />
          </div>
        </Card>

        <Card className="p-6 card-premium hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Agendamentos Pendentes</p>
              <p className="text-3xl font-bold mt-2">{stats.pendingAppointments}</p>
            </div>
            <Clock className="w-10 h-10 text-primary" />
          </div>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card className="p-6 card-premium">
        <h3 className="font-semibold text-lg mb-4">Evolução de Receita</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
            <YAxis stroke="hsl(var(--muted-foreground))" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }}
            />
            <Line 
              type="monotone" 
              dataKey="receita" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              dot={{ fill: 'hsl(var(--primary))' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Recent Appointments */}
      <Card className="p-6 card-premium">
        <h3 className="font-semibold text-lg mb-4">Agendamentos Recentes</h3>
        <div className="space-y-3">
          {recentAppointments.map((apt) => (
            <div
              key={apt.id}
              className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex-1">
                <p className="font-medium">{apt.profile?.nome || "Cliente"}</p>
                <p className="text-sm text-muted-foreground">
                  {apt.servico?.nome || "Serviço"} • {new Date(apt.data).toLocaleDateString('pt-BR')} às {apt.hora}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold">R$ {Number(apt.preco).toFixed(2)}</span>
                {getStatusBadge(apt.status)}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
