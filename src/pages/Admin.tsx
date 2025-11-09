import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, DollarSign, Users, TrendingUp, LogOut } from "lucide-react";
import { toast } from "sonner";
import logoDub from "@/assets/logo-dub.png";

const Admin = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    todayAppointments: 0,
    monthRevenue: 0,
    activeClients: 0,
    pendingPayments: 0,
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    // Check if user is admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin");

    if (!roles || roles.length === 0) {
      toast.error("Acesso não autorizado");
      navigate("/cliente");
      return;
    }

    loadStats();
  };

  const loadStats = async () => {
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

    // Active clients (profiles)
    const { count: clientsCount } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("blocked", false);

    // Pending payments
    const { count: pendingCount } = await supabase
      .from("pagamentos")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    setStats({
      todayAppointments: todayCount || 0,
      monthRevenue,
      activeClients: clientsCount || 0,
      pendingPayments: pendingCount || 0,
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoDub} alt="DUB" className="w-10 h-10" />
            <div>
              <h1 className="font-bold">Painel Administrativo</h1>
              <p className="text-xs text-muted-foreground">Barbearia DUB</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4 card-premium">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Agendamentos Hoje</p>
                <p className="text-2xl font-bold">{stats.todayAppointments}</p>
              </div>
              <Calendar className="w-8 h-8 text-primary" />
            </div>
          </Card>

          <Card className="p-4 card-premium">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Receita do Mês</p>
                <p className="text-2xl font-bold">
                  R$ {stats.monthRevenue.toFixed(2)}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-primary" />
            </div>
          </Card>

          <Card className="p-4 card-premium">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Clientes Ativos</p>
                <p className="text-2xl font-bold">{stats.activeClients}</p>
              </div>
              <Users className="w-8 h-8 text-primary" />
            </div>
          </Card>

          <Card className="p-4 card-premium">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Pagamentos Pendentes</p>
                <p className="text-2xl font-bold">{stats.pendingPayments}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-primary" />
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="appointments" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-card">
            <TabsTrigger value="appointments">Agendamentos</TabsTrigger>
            <TabsTrigger value="clients">Clientes</TabsTrigger>
            <TabsTrigger value="financial">Financeiro</TabsTrigger>
            <TabsTrigger value="services">Serviços</TabsTrigger>
          </TabsList>

          <TabsContent value="appointments" className="space-y-4">
            <Card className="p-6 card-premium">
              <h3 className="font-semibold mb-4">Agendamentos Recentes</h3>
              <p className="text-sm text-muted-foreground">
                Lista de agendamentos será implementada aqui
              </p>
            </Card>
          </TabsContent>

          <TabsContent value="clients" className="space-y-4">
            <Card className="p-6 card-premium">
              <h3 className="font-semibold mb-4">Gestão de Clientes</h3>
              <p className="text-sm text-muted-foreground">
                Lista de clientes será implementada aqui
              </p>
            </Card>
          </TabsContent>

          <TabsContent value="financial" className="space-y-4">
            <Card className="p-6 card-premium">
              <h3 className="font-semibold mb-4">Controle Financeiro</h3>
              <p className="text-sm text-muted-foreground">
                Relatórios financeiros serão implementados aqui
              </p>
            </Card>
          </TabsContent>

          <TabsContent value="services" className="space-y-4">
            <Card className="p-6 card-premium">
              <h3 className="font-semibold mb-4">Serviços e Planos</h3>
              <p className="text-sm text-muted-foreground">
                Gestão de serviços e planos será implementada aqui
              </p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
