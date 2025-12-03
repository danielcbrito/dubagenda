import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Clock, Save, Calendar, Coffee, Timer } from 'lucide-react';

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

const DIAS_SEMANA = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado'
];

export default function AdminHorarios() {
  const [configs, setConfigs] = useState<HorarioConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [delayGlobal, setDelayGlobal] = useState(10);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from('configuracoes_horario')
        .select('*')
        .order('dia_semana');

      if (error) throw error;

      if (data && data.length > 0) {
        setConfigs(data as HorarioConfig[]);
        setDelayGlobal(data[0].delay_entre_servicos);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      toast.error('Erro ao carregar configurações de horário');
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = (diaSemana: number, field: keyof HorarioConfig, value: any) => {
    setConfigs(prev => prev.map(config => 
      config.dia_semana === diaSemana 
        ? { ...config, [field]: value }
        : config
    ));
  };

  const updateDelayGlobal = (value: number) => {
    setDelayGlobal(value);
    setConfigs(prev => prev.map(config => ({
      ...config,
      delay_entre_servicos: value
    })));
  };

  const saveConfigs = async () => {
    setSaving(true);
    try {
      for (const config of configs) {
        const { error } = await supabase
          .from('configuracoes_horario')
          .update({
            aberto: config.aberto,
            hora_abertura: config.hora_abertura,
            hora_fechamento: config.hora_fechamento,
            hora_almoco_inicio: config.hora_almoco_inicio,
            hora_almoco_fim: config.hora_almoco_fim,
            delay_entre_servicos: config.delay_entre_servicos
          })
          .eq('dia_semana', config.dia_semana);

        if (error) throw error;
      }

      toast.success('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Horários de Funcionamento</h2>
          <p className="text-muted-foreground">Configure os horários de abertura, fechamento e intervalo entre serviços</p>
        </div>
        <Button onClick={saveConfigs} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar Alterações'}
        </Button>
      </div>

      {/* Delay Global */}
      <Card className="border-primary/20 bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Timer className="h-5 w-5 text-primary" />
            Intervalo Entre Atendimentos
          </CardTitle>
          <CardDescription>
            Tempo obrigatório de pausa entre um atendimento e outro
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Input
              type="number"
              min={0}
              max={60}
              value={delayGlobal}
              onChange={(e) => updateDelayGlobal(parseInt(e.target.value) || 0)}
              className="w-24"
            />
            <span className="text-muted-foreground">minutos</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Exemplo: Com delay de {delayGlobal}min, um corte de 30min às 09:00 termina às 09:30, 
            e o próximo horário disponível será às 09:{30 + delayGlobal >= 60 ? (30 + delayGlobal - 60).toString().padStart(2, '0') : (30 + delayGlobal).toString().padStart(2, '0')}.
          </p>
        </CardContent>
      </Card>

      {/* Configuração por Dia */}
      <div className="grid gap-4">
        {configs.map((config) => (
          <Card 
            key={config.dia_semana} 
            className={`transition-all ${!config.aberto ? 'opacity-60 bg-muted/30' : 'bg-card/50'}`}
          >
            <CardContent className="pt-6">
              <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-8">
                {/* Dia da Semana + Switch */}
                <div className="flex items-center gap-4 min-w-[200px]">
                  <Switch
                    checked={config.aberto}
                    onCheckedChange={(checked) => updateConfig(config.dia_semana, 'aberto', checked)}
                  />
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className={`font-medium ${config.aberto ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {DIAS_SEMANA[config.dia_semana]}
                    </span>
                  </div>
                </div>

                {config.aberto && (
                  <>
                    {/* Horário de Funcionamento */}
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div className="flex items-center gap-2">
                        <Label className="text-sm text-muted-foreground whitespace-nowrap">Abre:</Label>
                        <Input
                          type="time"
                          value={config.hora_abertura}
                          onChange={(e) => updateConfig(config.dia_semana, 'hora_abertura', e.target.value)}
                          className="w-28"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-sm text-muted-foreground whitespace-nowrap">Fecha:</Label>
                        <Input
                          type="time"
                          value={config.hora_fechamento}
                          onChange={(e) => updateConfig(config.dia_semana, 'hora_fechamento', e.target.value)}
                          className="w-28"
                        />
                      </div>
                    </div>

                    {/* Horário de Almoço */}
                    <div className="flex items-center gap-2">
                      <Coffee className="h-4 w-4 text-muted-foreground" />
                      <div className="flex items-center gap-2">
                        <Label className="text-sm text-muted-foreground whitespace-nowrap">Almoço:</Label>
                        <Input
                          type="time"
                          value={config.hora_almoco_inicio || ''}
                          onChange={(e) => updateConfig(config.dia_semana, 'hora_almoco_inicio', e.target.value || null)}
                          className="w-28"
                        />
                        <span className="text-muted-foreground">-</span>
                        <Input
                          type="time"
                          value={config.hora_almoco_fim || ''}
                          onChange={(e) => updateConfig(config.dia_semana, 'hora_almoco_fim', e.target.value || null)}
                          className="w-28"
                        />
                      </div>
                    </div>
                  </>
                )}

                {!config.aberto && (
                  <span className="text-muted-foreground italic">Fechado</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Como funciona o cálculo de horários
          </h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Cada serviço tem uma duração específica (ex: 30min para corte)</li>
            <li>• Após cada atendimento, há um intervalo obrigatório de <strong>{delayGlobal} minutos</strong></li>
            <li>• O último horário disponível considera: duração do serviço + intervalo ≤ hora de fechamento</li>
            <li>• Horários de almoço são automaticamente bloqueados</li>
            <li>• Todas as mudanças são sincronizadas com o Google Calendar</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
