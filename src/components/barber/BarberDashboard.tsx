import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  Clock,
  CheckCircle2,
  XCircle,
  Users
} from 'lucide-react';

interface BarberDashboardProps {
  barbeiroId: string;
}

export function BarberDashboard({ barbeiroId }: BarberDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    todayAppointments: 0,
    todayRevenue: 0,
    monthAppointments: 0,
    monthRevenue: 0,
    pendingConfirmation: 0,
    completedToday: 0
  });
  const [todayAppointments, setTodayAppointments] = useState<any[]>([]);

  useEffect(() => {
    loadDashboard();
  }, [barbeiroId]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd');

      // Agendamentos de hoje
      const { data: todayData } = await supabase
        .from('agendamentos')
        .select(`
          *,
          profiles:user_id (nome),
          servicos:servico_id (nome, preco)
        `)
        .eq('barbeiro_id', barbeiroId)
        .eq('data', todayStr)
        .not('status', 'in', '("cancelled_by_user","cancelled_by_admin","excluido")')
        .order('hora');

      // Agendamentos do mês completados
      const { data: monthData } = await supabase
        .from('agendamentos')
        .select('preco, status')
        .eq('barbeiro_id', barbeiroId)
        .gte('data', monthStart)
        .lte('data', monthEnd)
        .eq('status', 'completed');

      // Pendentes de confirmação
      const { count: pendingCount } = await supabase
        .from('agendamentos')
        .select('*', { count: 'exact', head: true })
        .eq('barbeiro_id', barbeiroId)
        .eq('status', 'pending')
        .eq('barbeiro_confirmou', false);

      const todayRevenue = (todayData || [])
        .filter(a => a.status === 'completed')
        .reduce((sum, a) => sum + (a.preco || 0), 0);

      const monthRevenue = (monthData || [])
        .reduce((sum, a) => sum + (a.preco || 0), 0);

      const completedToday = (todayData || [])
        .filter(a => a.status === 'completed').length;

      setStats({
        todayAppointments: todayData?.length || 0,
        todayRevenue,
        monthAppointments: monthData?.length || 0,
        monthRevenue,
        pendingConfirmation: pendingCount || 0,
        completedToday
      });

      setTodayAppointments(todayData || []);
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Concluído</Badge>;
      case 'confirmed':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Confirmado</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pendente</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Meu Dashboard</h1>
        <p className="text-muted-foreground">
          {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Hoje</p>
                <p className="text-2xl font-bold">{stats.todayAppointments}</p>
                <p className="text-xs text-muted-foreground">agendamentos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Receita Hoje</p>
                <p className="text-2xl font-bold">R$ {stats.todayRevenue.toFixed(0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Este Mês</p>
                <p className="text-2xl font-bold">R$ {stats.monthRevenue.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">{stats.monthAppointments} cortes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold">{stats.pendingConfirmation}</p>
                <p className="text-xs text-muted-foreground">aguardando</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agenda do Dia */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Agenda de Hoje
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todayAppointments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum agendamento para hoje</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayAppointments.map((apt) => (
                <div 
                  key={apt.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-border/30"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-center min-w-[60px]">
                      <p className="text-lg font-bold text-foreground">
                        {apt.hora?.substring(0, 5)}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {apt.profiles?.nome || 'Cliente'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {apt.servicos?.nome}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-primary">
                      R$ {apt.preco?.toFixed(0)}
                    </span>
                    {getStatusBadge(apt.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
