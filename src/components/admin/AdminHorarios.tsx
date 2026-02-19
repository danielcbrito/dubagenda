import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Clock, Save, Calendar, Coffee, Timer, Palmtree, User } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import HorariosExcepcionais from './HorariosExcepcionais';
import VacationMode from './VacationMode';
import { useBarbeiroLogado } from '@/hooks/useBarbeiroLogado';

interface HorarioConfig {
  id?: string;
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

const DEFAULT_CONFIG: Omit<HorarioConfig, 'id'> = {
  dia_semana: 0,
  aberto: true,
  hora_abertura: '09:00',
  hora_fechamento: '20:00',
  hora_almoco_inicio: '13:00',
  hora_almoco_fim: '14:00',
  delay_entre_servicos: 10,
};

export default function AdminHorarios() {
  const { barbeiroId, barbeiro, loading: loadingBarbeiro } = useBarbeiroLogado();
  const [configs, setConfigs] = useState<HorarioConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [delayGlobal, setDelayGlobal] = useState(10);

  // Modo: 'barbeiro' = salva em configuracoes_horario_barbeiro, 'global' = salva em configuracoes_horario
  const isBarbeiroMode = !!barbeiroId;

  useEffect(() => {
    if (!loadingBarbeiro) {
      loadConfigs();
    }
  }, [loadingBarbeiro, barbeiroId]);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      if (isBarbeiroMode && barbeiroId) {
        // ── MODO BARBEIRO: carrega configuracoes_horario_barbeiro ──
        const { data: barbeiroCfg, error } = await supabase
          .from('configuracoes_horario_barbeiro')
          .select('*')
          .eq('barbeiro_id', barbeiroId)
          .order('dia_semana');

        if (error) throw error;

        // Se o barbeiro ainda não tem configs, busca global como base
        if (!barbeiroCfg || barbeiroCfg.length === 0) {
          const { data: globalCfg } = await supabase
            .from('configuracoes_horario')
            .select('*')
            .order('dia_semana');

          const mapped: HorarioConfig[] = (globalCfg || []).map(g => ({
            dia_semana: g.dia_semana,
            aberto: g.aberto,
            hora_abertura: g.hora_abertura || '09:00',
            hora_fechamento: g.hora_fechamento || '20:00',
            hora_almoco_inicio: g.hora_almoco_inicio || null,
            hora_almoco_fim: g.hora_almoco_fim || null,
            delay_entre_servicos: g.delay_entre_servicos || 10,
          }));
          setConfigs(mapped);
          setDelayGlobal(mapped[0]?.delay_entre_servicos ?? 10);
        } else {
          const mapped: HorarioConfig[] = barbeiroCfg.map(b => ({
            id: b.id,
            dia_semana: b.dia_semana,
            aberto: b.aberto ?? true,
            hora_abertura: b.hora_abertura || '09:00',
            hora_fechamento: b.hora_fechamento || '20:00',
            hora_almoco_inicio: b.hora_almoco_inicio || null,
            hora_almoco_fim: b.hora_almoco_fim || null,
            delay_entre_servicos: b.delay_entre_servicos ?? 10,
          }));
          setConfigs(mapped);
          setDelayGlobal(mapped[0]?.delay_entre_servicos ?? 10);
        }
      } else {
        // ── MODO GLOBAL (admin puro): carrega configuracoes_horario ──
        const { data, error } = await supabase
          .from('configuracoes_horario')
          .select('*')
          .order('dia_semana');

        if (error) throw error;

        if (data && data.length > 0) {
          setConfigs(data as HorarioConfig[]);
          setDelayGlobal(data[0].delay_entre_servicos);
        }
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
      if (isBarbeiroMode && barbeiroId) {
        // ── MODO BARBEIRO: upsert em configuracoes_horario_barbeiro ──
        for (const config of configs) {
          const payload = {
            barbeiro_id: barbeiroId,
            dia_semana: config.dia_semana,
            aberto: config.aberto,
            hora_abertura: config.hora_abertura,
            hora_fechamento: config.hora_fechamento,
            hora_almoco_inicio: config.hora_almoco_inicio || null,
            hora_almoco_fim: config.hora_almoco_fim || null,
            delay_entre_servicos: config.delay_entre_servicos,
          };

          if (config.id) {
            // Registro já existe: atualiza
            const { error } = await supabase
              .from('configuracoes_horario_barbeiro')
              .update(payload)
              .eq('id', config.id);
            if (error) throw error;
          } else {
            // Novo registro: insert com on_conflict upsert
            const { data: inserted, error } = await supabase
              .from('configuracoes_horario_barbeiro')
              .upsert(payload, { onConflict: 'barbeiro_id,dia_semana' })
              .select();
            if (error) throw error;
            // Atualiza id local para futuras edições
            if (inserted && inserted[0]) {
              setConfigs(prev => prev.map(c =>
                c.dia_semana === config.dia_semana ? { ...c, id: inserted[0].id } : c
              ));
            }
          }
        }
        toast.success('Seus horários foram salvos com sucesso!');
      } else {
        // ── MODO GLOBAL: salva em configuracoes_horario ──
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
        toast.success('Configurações globais salvas com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (loadingBarbeiro || loading) {
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
          <p className="text-muted-foreground">
            {isBarbeiroMode
              ? 'Configure seus horários individuais de trabalho'
              : 'Configure os horários padrão globais e exceções'}
          </p>
        </div>
        {isBarbeiroMode && (
          <Badge variant="outline" className="gap-1.5 text-sm px-3 py-1.5">
            <User className="h-3.5 w-3.5" />
            {barbeiro?.apelido}
          </Badge>
        )}
      </div>

      {/* Aviso de modo */}
      {isBarbeiroMode && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-foreground">
              <strong>Seus horários individuais:</strong> As configurações aqui salvas são <strong>exclusivas para você</strong>{' '}
              e têm prioridade sobre os horários globais da barbearia. O sistema de agendamento usará estes horários
              para bloquear corretamente seu almoço e dias de folga.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="padrao" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="padrao" className="gap-2">
            <Calendar className="h-4 w-4" />
            Horários Padrão
          </TabsTrigger>
          <TabsTrigger value="excecoes" className="gap-2">
            <Clock className="h-4 w-4" />
            Exceções
          </TabsTrigger>
          <TabsTrigger value="ferias" className="gap-2">
            <Palmtree className="h-4 w-4" />
            Férias
          </TabsTrigger>
        </TabsList>

        {/* Tab: Horários Padrão */}
        <TabsContent value="padrao" className="space-y-6">
          {/* Botão Salvar */}
          <div className="flex justify-end">
            <Button onClick={saveConfigs} disabled={saving} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>

          {/* Delay */}
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
                e o próximo horário disponível será às 09:{(30 + delayGlobal) >= 60
                  ? (30 + delayGlobal - 60).toString().padStart(2, '0')
                  : (30 + delayGlobal).toString().padStart(2, '0')}.
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
                            <span className="text-muted-foreground">–</span>
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
                      <span className="text-muted-foreground italic">Fechado / Folga</span>
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
                <li>• Horários de almoço são automaticamente bloqueados para os clientes</li>
                {isBarbeiroMode && (
                  <li>• <strong>Seus horários têm prioridade</strong> sobre os horários globais da barbearia</li>
                )}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Exceções */}
        <TabsContent value="excecoes">
          <HorariosExcepcionais />
        </TabsContent>

        {/* Tab: Férias */}
        <TabsContent value="ferias">
          <VacationMode />
        </TabsContent>
      </Tabs>
    </div>
  );
}
