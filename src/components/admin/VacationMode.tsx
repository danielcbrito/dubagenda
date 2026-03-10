import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Palmtree, CalendarDays, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { useBarbeiroLogado } from '@/hooks/useBarbeiroLogado';

interface VacationPeriod {
  id: string;
  startDate: string;
  endDate: string;
  createdAt: string;
}

export default function VacationMode() {
  const [isVacationMode, setIsVacationMode] = useState(false);
  const [vacationPeriods, setVacationPeriods] = useState<VacationPeriod[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { barbeiroId } = useBarbeiroLogado();

  // Determina qual tabela usar
  const tableName = barbeiroId ? 'horarios_excepcionais_barbeiro' : 'horarios_excepcionais';

  useEffect(() => {
    if (barbeiroId !== undefined) {
      loadVacationPeriods();
    }
  }, [barbeiroId]);

  const loadVacationPeriods = async () => {
    try {
      let query = supabase
        .from(tableName as any)
        .select('*')
        .eq('aberto', false)
        .ilike('motivo', '%férias%')
        .order('data', { ascending: true });

      if (barbeiroId) {
        query = query.eq('barbeiro_id', barbeiroId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Agrupar dias consecutivos em períodos
      const periods: VacationPeriod[] = [];
      let currentPeriod: { start: string; end: string; id: string; createdAt: string } | null = null;

      ((data as any[]) || []).forEach((item: any, index: number) => {
        const itemDate = item.data;
        
        if (!currentPeriod) {
          currentPeriod = { 
            start: itemDate, end: itemDate, 
            id: item.id,
            createdAt: item.created_at || new Date().toISOString()
          };
        } else {
          const prevDate = new Date(currentPeriod.end + 'T12:00:00');
          const currDate = new Date(itemDate + 'T12:00:00');
          const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (diffDays === 1) {
            currentPeriod.end = itemDate;
          } else {
            periods.push({
              id: currentPeriod.id, startDate: currentPeriod.start,
              endDate: currentPeriod.end, createdAt: currentPeriod.createdAt
            });
            currentPeriod = { start: itemDate, end: itemDate, id: item.id, createdAt: item.created_at || new Date().toISOString() };
          }
        }
        
        if (index === ((data as any[]) || []).length - 1 && currentPeriod) {
          periods.push({
            id: currentPeriod.id, startDate: currentPeriod.start,
            endDate: currentPeriod.end, createdAt: currentPeriod.createdAt
          });
        }
      });

      setVacationPeriods(periods);
      setIsVacationMode(periods.length > 0);
    } catch (error) {
      console.error('Erro ao carregar períodos de férias:', error);
      toast.error('Erro ao carregar configurações de férias');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveVacation = async () => {
    if (!dateRange?.from || !dateRange?.to) {
      toast.error('Selecione o período de férias no calendário');
      return;
    }

    setSaving(true);
    try {
      const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
      
      for (const day of days) {
        const dateStr = format(day, 'yyyy-MM-dd');
        
        let existingQuery = supabase
          .from(tableName as any)
          .select('id')
          .eq('data', dateStr);

        if (barbeiroId) {
          existingQuery = existingQuery.eq('barbeiro_id', barbeiroId);
        }

        const { data: existing } = await existingQuery.maybeSingle();

        const insertData: any = {
          data: dateStr,
          aberto: false,
          motivo: 'Férias',
          hora_abertura: null,
          hora_fechamento: null,
          hora_almoco_inicio: null,
          hora_almoco_fim: null
        };
        if (barbeiroId) insertData.barbeiro_id = barbeiroId;

        if (existing) {
          await supabase
            .from(tableName as any)
            .update({ aberto: false, motivo: 'Férias', hora_abertura: null, hora_fechamento: null, hora_almoco_inicio: null, hora_almoco_fim: null })
            .eq('id', (existing as any).id);
        } else {
          await supabase
            .from(tableName as any)
            .insert(insertData);
        }
      }

      toast.success(`Férias configuradas! ${days.length} dias bloqueados.`);
      setDateRange(undefined);
      setIsVacationMode(true);
      await loadVacationPeriods();
    } catch (error) {
      console.error('Erro ao salvar férias:', error);
      toast.error('Erro ao configurar férias');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveVacation = async (startDate: string, endDate: string) => {
    setSaving(true);
    try {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      const days = eachDayOfInterval({ start, end });

      for (const day of days) {
        const dateStr = format(day, 'yyyy-MM-dd');
        let deleteQuery = supabase
          .from(tableName as any)
          .delete()
          .eq('data', dateStr)
          .ilike('motivo', '%férias%');

        if (barbeiroId) {
          deleteQuery = deleteQuery.eq('barbeiro_id', barbeiroId);
        }

        await deleteQuery;
      }

      toast.success('Período de férias removido');
      await loadVacationPeriods();
    } catch (error) {
      console.error('Erro ao remover férias:', error);
      toast.error('Erro ao remover período de férias');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAllVacations = async () => {
    if (!confirm('Tem certeza que deseja remover TODOS os períodos de férias?')) return;
    
    setSaving(true);
    try {
      let deleteQuery = supabase
        .from(tableName as any)
        .delete()
        .ilike('motivo', '%férias%');

      if (barbeiroId) {
        deleteQuery = deleteQuery.eq('barbeiro_id', barbeiroId);
      }

      await deleteQuery;

      toast.success('Todos os períodos de férias foram removidos');
      setIsVacationMode(false);
      setVacationPeriods([]);
    } catch (error) {
      console.error('Erro ao remover férias:', error);
      toast.error('Erro ao remover períodos de férias');
    } finally {
      setSaving(false);
    }
  };

  const vacationDays = vacationPeriods.flatMap(period => {
    const start = parseISO(period.startDate);
    const end = parseISO(period.endDate);
    return eachDayOfInterval({ start, end });
  });

  const formatPeriod = (startDate: string, endDate: string) => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const days = eachDayOfInterval({ start, end }).length;
    
    if (startDate === endDate) {
      return `${format(start, "dd 'de' MMMM", { locale: ptBR })} (1 dia)`;
    }
    return `${format(start, "dd/MM")} até ${format(end, "dd/MM/yyyy")} (${days} dias)`;
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
      <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10">
                <Palmtree className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <CardTitle className="text-xl">Modo Férias</CardTitle>
                <CardDescription>
                  {barbeiroId
                    ? 'Bloqueie sua agenda pessoal para férias (não afeta outros barbeiros)'
                    : 'Bloqueie um período inteiro para férias ou folga (afeta toda a barbearia)'}
                </CardDescription>
              </div>
            </div>
            {isVacationMode && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                <Palmtree className="h-3 w-3 mr-1" />
                Férias Ativas
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Períodos Ativos */}
          {vacationPeriods.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm text-muted-foreground">Períodos de Férias Configurados</h4>
                <Button variant="ghost" size="sm" onClick={handleRemoveAllVacations} disabled={saving}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4 mr-1" />
                  Remover Todos
                </Button>
              </div>
              <div className="grid gap-2">
                {vacationPeriods.map((period) => (
                  <div key={period.id} className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50">
                    <div className="flex items-center gap-3">
                      <CalendarDays className="h-4 w-4 text-amber-500" />
                      <span className="font-medium">{formatPeriod(period.startDate, period.endDate)}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleRemoveVacation(period.startDate, period.endDate)}
                      disabled={saving} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Adicionar Novo Período */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground">
              {vacationPeriods.length > 0 ? 'Adicionar Outro Período' : 'Selecione o Período de Férias'}
            </h4>
            
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex justify-center">
                <Calendar
                  mode="range" selected={dateRange} onSelect={setDateRange}
                  numberOfMonths={2} locale={ptBR}
                  disabled={(date) => date < new Date()}
                  modifiers={{ vacation: vacationDays }}
                  modifiersStyles={{
                    vacation: {
                      backgroundColor: 'hsl(var(--destructive) / 0.2)',
                      color: 'hsl(var(--destructive))',
                      fontWeight: 'bold'
                    }
                  }}
                  className={cn("p-4 pointer-events-auto rounded-xl border border-border/50 bg-background/50")}
                />
              </div>

              <div className="flex-1 space-y-4">
                {dateRange?.from && (
                  <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="pt-4">
                      <h5 className="font-medium mb-2 flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        Período Selecionado
                      </h5>
                      <p className="text-lg font-bold">
                        {dateRange.from && dateRange.to 
                          ? formatPeriod(format(dateRange.from, 'yyyy-MM-dd'), format(dateRange.to, 'yyyy-MM-dd'))
                          : format(dateRange.from, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                        }
                      </p>
                      {dateRange.from && dateRange.to && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {eachDayOfInterval({ start: dateRange.from, end: dateRange.to }).length} dias serão bloqueados
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                <Button onClick={handleSaveVacation} disabled={saving || !dateRange?.from || !dateRange?.to}
                  className="w-full gap-2 bg-amber-500 hover:bg-amber-600 text-primary-foreground" size="lg">
                  {saving ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Salvando...</>
                  ) : (
                    <><Palmtree className="h-4 w-4" />Ativar Férias para Este Período</>
                  )}
                </Button>

                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="flex gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-muted-foreground">
                      <p className="font-medium text-foreground mb-1">Como funciona:</p>
                      <ul className="space-y-0.5">
                        <li>• Clique no dia inicial e depois no dia final</li>
                        <li>• Todos os dias do período ficarão bloqueados</li>
                        <li>• {barbeiroId ? 'Clientes não poderão agendar COM VOCÊ nestes dias' : 'Clientes não poderão agendar nestes dias'}</li>
                        <li>• Os dias aparecerão em cinza no calendário de agendamento</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
