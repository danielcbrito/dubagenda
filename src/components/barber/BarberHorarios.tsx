import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Clock, Save } from 'lucide-react';

interface BarberHorariosProps {
  barbeiroId: string;
}

interface HorarioConfig {
  id: string;
  dia_semana: number;
  aberto: boolean;
  hora_abertura: string;
  hora_fechamento: string;
  hora_almoco_inicio: string | null;
  hora_almoco_fim: string | null;
  delay_entre_servicos: number;
}

const diasSemana = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado'
];

export function BarberHorarios({ barbeiroId }: BarberHorariosProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [horarios, setHorarios] = useState<HorarioConfig[]>([]);

  useEffect(() => {
    loadHorarios();
  }, [barbeiroId]);

  const loadHorarios = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('configuracoes_horario_barbeiro')
        .select('*')
        .eq('barbeiro_id', barbeiroId)
        .order('dia_semana');

      if (error) throw error;
      setHorarios(data || []);
    } catch (error) {
      console.error('Erro ao carregar horários:', error);
      toast.error('Erro ao carregar horários');
    } finally {
      setLoading(false);
    }
  };

  const updateHorario = (diaSemana: number, field: string, value: any) => {
    setHorarios(prev => prev.map(h => 
      h.dia_semana === diaSemana ? { ...h, [field]: value } : h
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const horario of horarios) {
        const { error } = await supabase
          .from('configuracoes_horario_barbeiro')
          .update({
            aberto: horario.aberto,
            hora_abertura: horario.hora_abertura,
            hora_fechamento: horario.hora_fechamento,
            hora_almoco_inicio: horario.hora_almoco_inicio,
            hora_almoco_fim: horario.hora_almoco_fim,
            delay_entre_servicos: horario.delay_entre_servicos,
            updated_at: new Date().toISOString()
          })
          .eq('id', horario.id);

        if (error) throw error;
      }
      toast.success('Horários salvos com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar horários');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        {[1, 2, 3, 4, 5, 6, 7].map(i => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Meus Horários</h1>
          <p className="text-muted-foreground">Configure seus horários de atendimento</p>
        </div>
        
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar Alterações'}
        </Button>
      </div>

      {/* Horários por dia */}
      <div className="space-y-4">
        {horarios.map((horario) => (
          <Card key={horario.id} className={`bg-card/50 border-border/50 transition-opacity ${!horario.aberto ? 'opacity-60' : ''}`}>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                {/* Dia e Toggle */}
                <div className="flex items-center gap-4 min-w-[180px]">
                  <Switch
                    checked={horario.aberto}
                    onCheckedChange={(checked) => updateHorario(horario.dia_semana, 'aberto', checked)}
                  />
                  <span className={`font-medium ${horario.aberto ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {diasSemana[horario.dia_semana]}
                  </span>
                </div>

                {horario.aberto && (
                  <div className="flex flex-wrap items-center gap-4">
                    {/* Horário de funcionamento */}
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">Abre:</Label>
                      <Input
                        type="time"
                        value={horario.hora_abertura}
                        onChange={(e) => updateHorario(horario.dia_semana, 'hora_abertura', e.target.value)}
                        className="w-28"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">Fecha:</Label>
                      <Input
                        type="time"
                        value={horario.hora_fechamento}
                        onChange={(e) => updateHorario(horario.dia_semana, 'hora_fechamento', e.target.value)}
                        className="w-28"
                      />
                    </div>

                    {/* Almoço */}
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">Almoço:</Label>
                      <Input
                        type="time"
                        value={horario.hora_almoco_inicio || ''}
                        onChange={(e) => updateHorario(horario.dia_semana, 'hora_almoco_inicio', e.target.value || null)}
                        className="w-28"
                        placeholder="Início"
                      />
                      <span className="text-muted-foreground">-</span>
                      <Input
                        type="time"
                        value={horario.hora_almoco_fim || ''}
                        onChange={(e) => updateHorario(horario.dia_semana, 'hora_almoco_fim', e.target.value || null)}
                        className="w-28"
                        placeholder="Fim"
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Dica</p>
              <p className="text-sm text-muted-foreground">
                Configure seus horários de acordo com sua disponibilidade. Os clientes só poderão agendar 
                nos horários que você definir como disponíveis.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
