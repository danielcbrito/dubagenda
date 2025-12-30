import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Palmtree, Calendar, Trash2 } from 'lucide-react';
import { format, parseISO, eachDayOfInterval, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface BarberVacationModeProps {
  barbeiroId: string;
}

interface VacationPeriod {
  startDate: string;
  endDate: string;
  motivo: string;
  excecaoIds: string[];
}

export function BarberVacationMode({ barbeiroId }: BarberVacationModeProps) {
  const [vacations, setVacations] = useState<VacationPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newVacation, setNewVacation] = useState({
    startDate: '',
    endDate: '',
    motivo: 'Férias'
  });

  useEffect(() => {
    loadVacations();
  }, [barbeiroId]);

  const loadVacations = async () => {
    try {
      // Buscar todas as exceções do barbeiro com motivo "Férias"
      const { data, error } = await supabase
        .from('horarios_excepcionais_barbeiro')
        .select('*')
        .eq('barbeiro_id', barbeiroId)
        .eq('aberto', false)
        .ilike('motivo', '%férias%')
        .order('data', { ascending: true });

      if (error) throw error;

      // Agrupar em períodos contínuos
      const periods: VacationPeriod[] = [];
      let currentPeriod: VacationPeriod | null = null;

      for (const exc of data || []) {
        const excDate = parseISO(exc.data);
        
        if (!currentPeriod) {
          currentPeriod = {
            startDate: exc.data,
            endDate: exc.data,
            motivo: exc.motivo || 'Férias',
            excecaoIds: [exc.id]
          };
        } else {
          const prevEnd = parseISO(currentPeriod.endDate);
          const dayDiff = Math.floor((excDate.getTime() - prevEnd.getTime()) / (1000 * 60 * 60 * 24));
          
          if (dayDiff === 1) {
            // Dia consecutivo - estender período
            currentPeriod.endDate = exc.data;
            currentPeriod.excecaoIds.push(exc.id);
          } else {
            // Novo período
            periods.push(currentPeriod);
            currentPeriod = {
              startDate: exc.data,
              endDate: exc.data,
              motivo: exc.motivo || 'Férias',
              excecaoIds: [exc.id]
            };
          }
        }
      }

      if (currentPeriod) {
        periods.push(currentPeriod);
      }

      // Filtrar apenas períodos futuros
      const futurePeriods = periods.filter(p => !isBefore(parseISO(p.endDate), startOfDay(new Date())));
      setVacations(futurePeriods);
    } catch (error) {
      console.error('Erro ao carregar férias:', error);
      toast.error('Erro ao carregar férias');
    } finally {
      setLoading(false);
    }
  };

  const handleAddVacation = async () => {
    if (!newVacation.startDate || !newVacation.endDate) {
      toast.error('Selecione as datas de início e fim');
      return;
    }

    const startDate = parseISO(newVacation.startDate);
    const endDate = parseISO(newVacation.endDate);

    if (isBefore(startDate, startOfDay(new Date()))) {
      toast.error('A data inicial deve ser hoje ou no futuro');
      return;
    }

    if (isBefore(endDate, startDate)) {
      toast.error('A data final deve ser depois da inicial');
      return;
    }

    setSaving(true);
    try {
      // Gerar todas as datas do período
      const dates = eachDayOfInterval({ start: startDate, end: endDate });
      
      // Criar exceções para cada dia
      const excecoes = dates.map(date => ({
        barbeiro_id: barbeiroId,
        data: format(date, 'yyyy-MM-dd'),
        aberto: false,
        motivo: newVacation.motivo || 'Férias'
      }));

      // Inserir todas as exceções (ignora duplicatas)
      for (const exc of excecoes) {
        const { error } = await supabase
          .from('horarios_excepcionais_barbeiro')
          .upsert(exc, { onConflict: 'barbeiro_id,data' });
        
        if (error && error.code !== '23505') {
          console.error('Erro ao inserir exceção:', error);
        }
      }

      toast.success(`Férias configuradas: ${dates.length} dias bloqueados`);
      setModalOpen(false);
      setNewVacation({ startDate: '', endDate: '', motivo: 'Férias' });
      loadVacations();
    } catch (error) {
      console.error('Erro ao adicionar férias:', error);
      toast.error('Erro ao adicionar férias');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVacation = async (vacation: VacationPeriod) => {
    try {
      // Deletar todas as exceções do período
      for (const id of vacation.excecaoIds) {
        await supabase
          .from('horarios_excepcionais_barbeiro')
          .delete()
          .eq('id', id);
      }

      toast.success('Férias removidas');
      loadVacations();
    } catch (error) {
      console.error('Erro ao remover férias:', error);
      toast.error('Erro ao remover férias');
    }
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    
    if (startDate === endDate) {
      return format(start, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    }
    
    return `${format(start, "dd 'de' MMMM", { locale: ptBR })} até ${format(end, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`;
  };

  const getDaysCount = (startDate: string, endDate: string) => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-green-500/30 bg-green-500/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <Palmtree className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <CardTitle className="text-lg">Minhas Férias</CardTitle>
                <CardDescription>
                  Configure períodos de férias ou ausências prolongadas
                </CardDescription>
              </div>
            </div>
            <Button onClick={() => setModalOpen(true)} className="gap-2">
              <Calendar className="h-4 w-4" />
              Agendar Férias
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Lista de Férias */}
      {vacations.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Períodos Agendados ({vacations.length})
          </h3>
          <div className="grid gap-3">
            {vacations.map((vacation, index) => (
              <Card key={index} className="bg-card/50 border-green-500/20">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-4">
                      <div className="p-2 rounded-lg bg-green-500/20">
                        <Palmtree className="h-5 w-5 text-green-500" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium capitalize">
                          {formatDateRange(vacation.startDate, vacation.endDate)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {getDaysCount(vacation.startDate, vacation.endDate)} dia(s) • {vacation.motivo}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteVacation(vacation)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Estado vazio */}
      {vacations.length === 0 && (
        <Card className="bg-card/50 border-dashed">
          <CardContent className="py-12 text-center">
            <Palmtree className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-4">
              Nenhum período de férias agendado
            </p>
            <Button onClick={() => setModalOpen(true)} variant="outline" className="gap-2">
              <Calendar className="h-4 w-4" />
              Agendar Férias
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Modal de Novas Férias */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palmtree className="h-5 w-5 text-green-500" />
              Agendar Férias
            </DialogTitle>
            <DialogDescription>
              Configure um período de ausência. Todos os dias serão bloqueados automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={newVacation.startDate}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  onChange={(e) => setNewVacation(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={newVacation.endDate}
                  min={newVacation.startDate || format(new Date(), 'yyyy-MM-dd')}
                  onChange={(e) => setNewVacation(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Motivo</Label>
              <Textarea
                placeholder="Ex: Férias, viagem, descanso..."
                value={newVacation.motivo}
                onChange={(e) => setNewVacation(prev => ({ ...prev, motivo: e.target.value }))}
                rows={2}
              />
            </div>

            {newVacation.startDate && newVacation.endDate && (
              <div className="p-3 rounded-lg bg-green-500/10 text-sm text-green-700 dark:text-green-400">
                <strong>{getDaysCount(newVacation.startDate, newVacation.endDate)}</strong> dia(s) serão bloqueados para agendamentos
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddVacation} disabled={saving} className="gap-2">
              {saving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Palmtree className="h-4 w-4" />
              )}
              Confirmar Férias
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
