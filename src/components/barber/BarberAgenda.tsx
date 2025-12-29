import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Clock,
  User,
  Check,
  X
} from 'lucide-react';

interface BarberAgendaProps {
  barbeiroId: string;
}

export function BarberAgenda({ barbeiroId }: BarberAgendaProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAppointments();
  }, [selectedDate, barbeiroId]);

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('agendamentos')
        .select(`
          *,
          profiles:user_id (nome, telefone),
          servicos:servico_id (nome, preco, duracao_minutos)
        `)
        .eq('barbeiro_id', barbeiroId)
        .eq('data', dateStr)
        .not('status', 'in', '("cancelled_by_user","cancelled_by_admin","excluido")')
        .order('hora');

      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      console.error('Erro ao carregar agenda:', error);
      toast.error('Erro ao carregar agenda');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (appointmentId: string) => {
    try {
      const { error } = await supabase
        .from('agendamentos')
        .update({ 
          barbeiro_confirmou: true,
          status: 'confirmed'
        })
        .eq('id', appointmentId);

      if (error) throw error;
      toast.success('Agendamento confirmado!');
      loadAppointments();
    } catch (error) {
      toast.error('Erro ao confirmar agendamento');
    }
  };

  const handleComplete = async (appointmentId: string) => {
    try {
      const { error } = await supabase
        .from('agendamentos')
        .update({ status: 'completed' })
        .eq('id', appointmentId);

      if (error) throw error;
      toast.success('Atendimento concluído!');
      loadAppointments();
    } catch (error) {
      toast.error('Erro ao concluir atendimento');
    }
  };

  const handleNoShow = async (appointmentId: string) => {
    try {
      const { error } = await supabase
        .from('agendamentos')
        .update({ status: 'no_show' })
        .eq('id', appointmentId);

      if (error) throw error;
      toast.success('Marcado como não compareceu');
      loadAppointments();
    } catch (error) {
      toast.error('Erro ao atualizar status');
    }
  };

  const getStatusBadge = (apt: any) => {
    if (apt.status === 'completed') {
      return <Badge className="bg-green-500/20 text-green-400">Concluído</Badge>;
    }
    if (apt.status === 'confirmed') {
      return <Badge className="bg-blue-500/20 text-blue-400">Confirmado</Badge>;
    }
    if (apt.status === 'no_show') {
      return <Badge className="bg-red-500/20 text-red-400">Não compareceu</Badge>;
    }
    if (apt.status === 'pending') {
      return <Badge className="bg-yellow-500/20 text-yellow-400">Pendente</Badge>;
    }
    return <Badge variant="secondary">{apt.status}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Minha Agenda</h1>
          <p className="text-muted-foreground">Gerencie seus agendamentos</p>
        </div>
      </div>

      {/* Date Navigation */}
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedDate(subDays(selectedDate, 1))}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">
                {format(selectedDate, "EEEE", { locale: ptBR })}
              </p>
              <p className="text-sm text-muted-foreground">
                {format(selectedDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          
          <div className="flex justify-center mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(new Date())}
            >
              Hoje
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Appointments List */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Agendamentos ({appointments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          ) : appointments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum agendamento para este dia</p>
            </div>
          ) : (
            <div className="space-y-4">
              {appointments.map((apt) => (
                <div 
                  key={apt.id}
                  className="p-4 rounded-lg bg-background/50 border border-border/30 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-center min-w-[60px] p-2 rounded-lg bg-primary/10">
                        <p className="text-lg font-bold text-primary">
                          {apt.hora?.substring(0, 5)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {apt.duracao}min
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground flex items-center gap-2">
                          <User className="h-4 w-4" />
                          {apt.profiles?.nome || 'Cliente'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {apt.servicos?.nome}
                        </p>
                        {apt.profiles?.telefone && (
                          <p className="text-xs text-muted-foreground">
                            {apt.profiles.telefone}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">
                        R$ {apt.preco?.toFixed(0)}
                      </p>
                      {getStatusBadge(apt)}
                    </div>
                  </div>

                  {/* Actions */}
                  {apt.status === 'pending' && !apt.barbeiro_confirmou && (
                    <div className="flex gap-2 pt-2 border-t border-border/30">
                      <Button
                        size="sm"
                        className="flex-1 gap-2"
                        onClick={() => handleConfirm(apt.id)}
                      >
                        <Check className="h-4 w-4" />
                        Confirmar
                      </Button>
                    </div>
                  )}

                  {(apt.status === 'confirmed' || apt.status === 'pending') && apt.barbeiro_confirmou && (
                    <div className="flex gap-2 pt-2 border-t border-border/30">
                      <Button
                        size="sm"
                        className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                        onClick={() => handleComplete(apt.id)}
                      >
                        <Check className="h-4 w-4" />
                        Concluir
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2 text-red-400 hover:text-red-300"
                        onClick={() => handleNoShow(apt.id)}
                      >
                        <X className="h-4 w-4" />
                        Não veio
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
