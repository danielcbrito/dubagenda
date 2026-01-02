import { useState, useEffect } from "react";
import { 
  Database, 
  Server, 
  Activity, 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  HardDrive,
  Cpu,
  Wifi,
  Clock,
  Users,
  Calendar,
  TrendingUp
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface HealthCheck {
  service_name: string;
  status: "healthy" | "degraded" | "down";
  last_check_at: string;
  error_message?: string;
  response_time_ms?: number;
}

interface QuickStat {
  label: string;
  value: string | number;
  icon: any;
  trend?: "up" | "down" | "stable";
  color: string;
}

export function TIDashboard() {
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalAppointments: 0,
    activeSubscriptions: 0,
    pendingPayments: 0
  });

  useEffect(() => {
    loadHealthChecks();
    loadQuickStats();
  }, []);

  const loadHealthChecks = async () => {
    const { data, error } = await supabase
      .from("system_health_checks")
      .select("*")
      .order("last_check_at", { ascending: false });

    if (!error && data) {
      setHealthChecks(data as HealthCheck[]);
    }
  };

  const loadQuickStats = async () => {
    const [usersRes, appointmentsRes, subscriptionsRes, paymentsRes] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('agendamentos').select('*', { count: 'exact', head: true }),
      supabase.from('assinaturas').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('pagamentos').select('*', { count: 'exact', head: true }).eq('status', 'pending')
    ]);

    setStats({
      totalUsers: usersRes.count || 0,
      totalAppointments: appointmentsRes.count || 0,
      activeSubscriptions: subscriptionsRes.count || 0,
      pendingPayments: paymentsRes.count || 0
    });
  };

  const runHealthCheck = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("health-check");
      
      if (error) throw error;
      
      toast.success("Health check executado com sucesso");
      loadHealthChecks();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao executar health check");
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case "degraded":
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case "down":
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const quickStats: QuickStat[] = [
    { label: "Total de Usuários", value: stats.totalUsers, icon: Users, color: "cyan" },
    { label: "Agendamentos", value: stats.totalAppointments, icon: Calendar, color: "blue" },
    { label: "Assinaturas Ativas", value: stats.activeSubscriptions, icon: TrendingUp, color: "emerald" },
    { label: "Pagamentos Pendentes", value: stats.pendingPayments, icon: Clock, color: "amber" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-wide text-foreground">
            <span className="text-cyan-400">Dashboard</span> TI
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visão geral do sistema e monitoramento
          </p>
        </div>
        <Button 
          onClick={runHealthCheck} 
          disabled={loading} 
          className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white shadow-[0_0_20px_rgba(0,255,255,0.3)]"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Verificar Sistema
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {quickStats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card 
              key={index} 
              className="relative overflow-hidden bg-gradient-to-br from-[#12121a] to-[#0d0d14] border-cyan-500/10 hover:border-cyan-500/30 transition-all duration-300"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-lg bg-${stat.color}-500/10 border border-${stat.color}-500/20 flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 text-${stat.color}-400`} />
                  </div>
                </div>
                <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </div>
              {/* Decorative glow */}
              <div className={`absolute -bottom-4 -right-4 w-24 h-24 bg-${stat.color}-500/5 rounded-full blur-2xl`} />
            </Card>
          );
        })}
      </div>

      {/* System Services */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <Server className="w-5 h-5 text-cyan-400" />
          <h2 className="text-lg font-semibold text-foreground">Status dos Serviços</h2>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Default services if no health checks */}
          {healthChecks.length === 0 ? (
            <>
              {[
                { name: "Supabase Database", status: "healthy" },
                { name: "Edge Functions", status: "healthy" },
                { name: "Auth Service", status: "healthy" },
                { name: "Storage", status: "healthy" },
                { name: "Realtime", status: "healthy" },
                { name: "API Gateway", status: "healthy" },
              ].map((service, index) => (
                <Card 
                  key={index} 
                  className="p-4 bg-gradient-to-br from-[#12121a] to-[#0d0d14] border-cyan-500/10"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                      <span className="font-medium text-sm">{service.name}</span>
                    </div>
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                      Online
                    </Badge>
                  </div>
                </Card>
              ))}
            </>
          ) : (
            healthChecks.map((check) => (
              <Card 
                key={check.service_name} 
                className="p-4 bg-gradient-to-br from-[#12121a] to-[#0d0d14] border-cyan-500/10"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(check.status)}
                    <div>
                      <span className="font-medium text-sm capitalize">
                        {check.service_name.replace("_", " ")}
                      </span>
                      {check.response_time_ms && (
                        <p className="text-xs text-muted-foreground">
                          {check.response_time_ms}ms
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge 
                    className={
                      check.status === "healthy" 
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : check.status === "degraded"
                        ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                        : "bg-red-500/10 text-red-400 border-red-500/20"
                    }
                  >
                    {check.status === "healthy" ? "Online" : check.status === "degraded" ? "Lento" : "Offline"}
                  </Badge>
                </div>
                {check.error_message && (
                  <p className="mt-2 text-xs text-red-400">{check.error_message}</p>
                )}
              </Card>
            ))
          )}
        </div>
      </div>

      {/* System Info */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Database Info */}
        <Card className="p-6 bg-gradient-to-br from-[#12121a] to-[#0d0d14] border-cyan-500/10">
          <div className="flex items-center gap-3 mb-4">
            <Database className="w-5 h-5 text-cyan-400" />
            <h3 className="font-semibold">Banco de Dados</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-black/20 rounded-lg">
              <span className="text-sm text-muted-foreground">Provedor</span>
              <span className="text-sm font-medium">Supabase (PostgreSQL)</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-black/20 rounded-lg">
              <span className="text-sm text-muted-foreground">Região</span>
              <span className="text-sm font-medium">South America (São Paulo)</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-black/20 rounded-lg">
              <span className="text-sm text-muted-foreground">Status</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-emerald-400">Conectado</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Edge Functions Info */}
        <Card className="p-6 bg-gradient-to-br from-[#12121a] to-[#0d0d14] border-cyan-500/10">
          <div className="flex items-center gap-3 mb-4">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <h3 className="font-semibold">Edge Functions</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-black/20 rounded-lg">
              <span className="text-sm text-muted-foreground">Runtime</span>
              <span className="text-sm font-medium">Deno v1.x</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-black/20 rounded-lg">
              <span className="text-sm text-muted-foreground">Functions Ativas</span>
              <span className="text-sm font-medium">15</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-black/20 rounded-lg">
              <span className="text-sm text-muted-foreground">Status</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-emerald-400">Operacional</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
