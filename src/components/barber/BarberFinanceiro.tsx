import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  DollarSign, 
  TrendingUp, 
  Calendar,
  Scissors,
  Percent,
  Wallet,
  FileText,
  CheckCircle2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface BarberFinanceiroProps {
  barbeiroId: string;
}

interface DailyChartData {
  date: string;
  label: string;
  receita: number;
}

export function BarberFinanceiro({ barbeiroId }: BarberFinanceiroProps) {
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalAppointments: 0,
    completedAppointments: 0,
    avgTicket: 0,
    commission: 0,
    commissionPct: 0,
    pendingCommission: 0,
    paidCommission: 0
  });
  const [appointments, setAppointments] = useState<any[]>([]);
  const [dailyChartData, setDailyChartData] = useState<DailyChartData[]>([]);
  const [requestingPayment, setRequestingPayment] = useState(false);

  // Gerar opções de meses
  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, "MMMM 'de' yyyy", { locale: ptBR })
    };
  });

  useEffect(() => {
    loadFinanceiro();
  }, [selectedMonth, barbeiroId]);

  const loadFinanceiro = async () => {
    setLoading(true);
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = format(new Date(year, month - 1, 1), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(new Date(year, month - 1, 1)), 'yyyy-MM-dd');

      // Buscar agendamentos completados
      const { data: appointmentsData, error } = await supabase
        .from('agendamentos')
        .select(`
          *,
          profiles:user_id (nome),
          servicos:servico_id (nome)
        `)
        .eq('barbeiro_id', barbeiroId)
        .gte('data', startDate)
        .lte('data', endDate)
        .eq('status', 'completed')
        .order('data', { ascending: false });

      if (error) throw error;

      // Buscar comissão do barbeiro
      const { data: barbeiroData } = await supabase
        .from('barbeiros')
        .select('comissao_pct')
        .eq('id', barbeiroId)
        .single();

      // Buscar comissões já pagas do período
      const { data: comissoesData } = await supabase
        .from('comissoes')
        .select('valor, pago')
        .eq('barbeiro_id', barbeiroId)
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`);

      const paidCommission = (comissoesData || [])
        .filter(c => c.pago)
        .reduce((sum, c) => sum + (c.valor || 0), 0);

      const commissionPct = barbeiroData?.comissao_pct || 30;
      const totalRevenue = (appointmentsData || []).reduce((sum, a) => sum + (a.preco || 0), 0);
      const commission = totalRevenue * (commissionPct / 100);
      const pendingCommission = commission - paidCommission;
      const avgTicket = appointmentsData && appointmentsData.length > 0 
        ? totalRevenue / appointmentsData.length 
        : 0;

      // Calcular dados diários para o gráfico
      const chartData: DailyChartData[] = [];
      const daysInMonth = new Date(year, month, 0).getDate();
      
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = format(new Date(year, month - 1, day), 'yyyy-MM-dd');
        const dayAppointments = (appointmentsData || []).filter(apt => apt.data === dateStr);
        const dayRevenue = dayAppointments.reduce((sum, apt) => sum + (apt.preco || 0), 0);
        
        chartData.push({
          date: dateStr,
          label: format(new Date(year, month - 1, day), 'dd'),
          receita: dayRevenue * (commissionPct / 100) // Mostrar comissão do dia
        });
      }

      setStats({
        totalRevenue,
        totalAppointments: appointmentsData?.length || 0,
        completedAppointments: appointmentsData?.length || 0,
        avgTicket,
        commission,
        commissionPct,
        pendingCommission: Math.max(0, pendingCommission),
        paidCommission
      });

      setAppointments(appointmentsData || []);
      setDailyChartData(chartData);
    } catch (error) {
      console.error('Erro ao carregar financeiro:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Meu Financeiro</h1>
          <p className="text-muted-foreground">Acompanhe seus ganhos e comissões</p>
        </div>
        
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Comissão a Receber - Card destacado */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-primary/20 flex items-center justify-center">
                <Wallet className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Comissão a Receber</p>
                <p className="text-3xl font-bold text-primary">R$ {stats.pendingCommission.toFixed(2)}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {stats.commissionPct}% de comissão
                  </Badge>
                  {stats.paidCommission > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      R$ {stats.paidCommission.toFixed(0)} já pago
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <Button 
              onClick={() => {
                toast.info('Solicitação de pagamento enviada para a barbearia!');
              }}
              disabled={stats.pendingCommission <= 0 || requestingPayment}
              className="w-full sm:w-auto"
            >
              <FileText className="h-4 w-4 mr-2" />
              Solicitar Pagamento
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Receita Gerada</p>
                <p className="text-2xl font-bold">R$ {stats.totalRevenue.toFixed(0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Percent className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Comissão Total</p>
                <p className="text-2xl font-bold text-primary">R$ {stats.commission.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">{stats.commissionPct}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Scissors className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cortes Realizados</p>
                <p className="text-2xl font-bold">{stats.completedAppointments}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ticket Médio</p>
                <p className="text-2xl font-bold">R$ {stats.avgTicket.toFixed(0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Evolução da Comissão */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Evolução da Comissão
          </CardTitle>
          <p className="text-sm text-muted-foreground">Comissão diária do mês selecionado</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyChartData}>
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
                formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Comissão']}
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
        </CardContent>
      </Card>

      {/* Lista de atendimentos */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Atendimentos Realizados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {appointments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Scissors className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum atendimento neste período</p>
            </div>
          ) : (
            <div className="space-y-3">
              {appointments.map((apt) => (
                <div 
                  key={apt.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/30"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-center min-w-[70px]">
                      <p className="text-sm font-medium text-foreground">
                        {format(new Date(apt.data), 'dd/MM')}
                      </p>
                      <p className="text-xs text-muted-foreground">
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
                  <div className="text-right">
                    <p className="font-bold text-foreground">R$ {apt.preco?.toFixed(0)}</p>
                    <p className="text-xs text-primary">
                      +R$ {(apt.preco * stats.commissionPct / 100).toFixed(0)}
                    </p>
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
