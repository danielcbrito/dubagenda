import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Calendar, Clock, Coffee, Plus, Trash2, AlertTriangle, X } from 'lucide-react';
import { format, parseISO, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface BarberHorariosExcepcionaisProps {
  barbeiroId: string;
}

interface HorarioExcepcional {
  id: string;
  data: string;
  aberto: boolean;
  hora_abertura: string | null;
  hora_fechamento: string | null;
  hora_almoco_inicio: string | null;
  hora_almoco_fim: string | null;
  motivo: string | null;
}

interface NovaExcecao {
  data: string;
  aberto: boolean;
  hora_abertura: string;
  hora_fechamento: string;
  hora_almoco_inicio: string;
  hora_almoco_fim: string;
  motivo: string;
}

export function BarberHorariosExcepcionais({ barbeiroId }: BarberHorariosExcepcionaisProps) {
  const [excecoes, setExcecoes] = useState<HorarioExcepcional[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [novaExcecao, setNovaExcecao] = useState<NovaExcecao>({
    data: '',
    aberto: true,
    hora_abertura: '09:00',
    hora_fechamento: '20:00',
    hora_almoco_inicio: '13:00',
    hora_almoco_fim: '14:00',
    motivo: ''
  });

  useEffect(() => {
    loadExcecoes();
  }, [barbeiroId]);

  const loadExcecoes = async () => {
    try {
      const { data, error } = await supabase
        .from('horarios_excepcionais_barbeiro')
        .select('*')
        .eq('barbeiro_id', barbeiroId)
        .order('data', { ascending: true });

      if (error) throw error;
      setExcecoes(data || []);
    } catch (error) {
      console.error('Erro ao carregar exceções:', error);
      toast.error('Erro ao carregar exceções de horário');
    } finally {
      setLoading(false);
    }
  };

  const handleAddExcecao = async () => {
    if (!novaExcecao.data) {
      toast.error('Selecione uma data');
      return;
    }

    const dataExcecao = parseISO(novaExcecao.data);
    if (isBefore(dataExcecao, startOfDay(new Date()))) {
      toast.error('A data deve ser hoje ou no futuro');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('horarios_excepcionais_barbeiro')
        .insert({
          barbeiro_id: barbeiroId,
          data: novaExcecao.data,
          aberto: novaExcecao.aberto,
          hora_abertura: novaExcecao.aberto ? novaExcecao.hora_abertura : null,
          hora_fechamento: novaExcecao.aberto ? novaExcecao.hora_fechamento : null,
          hora_almoco_inicio: novaExcecao.aberto && novaExcecao.hora_almoco_inicio ? novaExcecao.hora_almoco_inicio : null,
          hora_almoco_fim: novaExcecao.aberto && novaExcecao.hora_almoco_fim ? novaExcecao.hora_almoco_fim : null,
          motivo: novaExcecao.motivo || null
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('Já existe uma exceção para esta data');
        } else {
          throw error;
        }
        return;
      }

      toast.success('Exceção de horário adicionada!');
      setModalOpen(false);
      resetForm();
      loadExcecoes();
    } catch (error) {
      console.error('Erro ao adicionar exceção:', error);
      toast.error('Erro ao adicionar exceção');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExcecao = async (id: string) => {
    try {
      const { error } = await supabase
        .from('horarios_excepcionais_barbeiro')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Exceção removida');
      loadExcecoes();
    } catch (error) {
      console.error('Erro ao remover exceção:', error);
      toast.error('Erro ao remover exceção');
    }
  };

  const resetForm = () => {
    setNovaExcecao({
      data: '',
      aberto: true,
      hora_abertura: '09:00',
      hora_fechamento: '20:00',
      hora_almoco_inicio: '13:00',
      hora_almoco_fim: '14:00',
      motivo: ''
    });
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const isDatePast = (dateStr: string) => {
    try {
      return isBefore(parseISO(dateStr), startOfDay(new Date()));
    } catch {
      return false;
    }
  };

  const excecoesFuturas = excecoes.filter(e => !isDatePast(e.data));
  const excecoesPassadas = excecoes.filter(e => isDatePast(e.data));

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
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <CardTitle className="text-lg">Minhas Exceções de Horário</CardTitle>
                <CardDescription>
                  Configure horários especiais para datas específicas (ex: médico, compromisso)
                </CardDescription>
              </div>
            </div>
            <Button onClick={() => setModalOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Exceção
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Lista de Exceções Futuras */}
      {excecoesFuturas.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Próximas Exceções ({excecoesFuturas.length})
          </h3>
          <div className="grid gap-3">
            {excecoesFuturas.map((excecao) => (
              <Card 
                key={excecao.id} 
                className={`transition-all ${!excecao.aberto ? 'border-destructive/30 bg-destructive/5' : 'bg-card/50'}`}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${excecao.aberto ? 'bg-primary/20' : 'bg-destructive/20'}`}>
                        <Calendar className={`h-5 w-5 ${excecao.aberto ? 'text-primary' : 'text-destructive'}`} />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium capitalize">
                          {formatDate(excecao.data)}
                        </p>
                        {excecao.motivo && (
                          <p className="text-sm text-muted-foreground">
                            Motivo: {excecao.motivo}
                          </p>
                        )}
                        {excecao.aberto ? (
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {excecao.hora_abertura?.slice(0, 5)} - {excecao.hora_fechamento?.slice(0, 5)}
                            </span>
                            {excecao.hora_almoco_inicio && excecao.hora_almoco_fim && (
                              <span className="flex items-center gap-1">
                                <Coffee className="h-3.5 w-3.5" />
                                Almoço: {excecao.hora_almoco_inicio?.slice(0, 5)} - {excecao.hora_almoco_fim?.slice(0, 5)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-destructive font-medium">
                            Não vou trabalhar neste dia
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteExcecao(excecao.id)}
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
      {excecoesFuturas.length === 0 && (
        <Card className="bg-card/50 border-dashed">
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-4">
              Nenhuma exceção de horário configurada
            </p>
            <Button onClick={() => setModalOpen(true)} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Primeira Exceção
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Exceções Passadas */}
      {excecoesPassadas.length > 0 && (
        <div className="space-y-3 opacity-60">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Exceções Passadas ({excecoesPassadas.length})
          </h3>
          <div className="grid gap-2">
            {excecoesPassadas.slice(0, 5).map((excecao) => (
              <Card key={excecao.id} className="bg-muted/30">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground capitalize">
                        {formatDate(excecao.data)}
                      </span>
                      {!excecao.aberto && (
                        <span className="text-xs bg-destructive/20 text-destructive px-2 py-0.5 rounded">
                          Folga
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteExcecao(excecao.id)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Modal de Nova Exceção */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Nova Exceção de Horário
            </DialogTitle>
            <DialogDescription>
              Configure um horário diferente para uma data específica
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Data */}
            <div className="space-y-2">
              <Label>Data</Label>
              <Input
                type="date"
                value={novaExcecao.data}
                min={format(new Date(), 'yyyy-MM-dd')}
                onChange={(e) => setNovaExcecao(prev => ({ ...prev, data: e.target.value }))}
                className="w-full"
              />
            </div>

            {/* Aberto/Fechado */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div>
                <Label>Vou trabalhar neste dia?</Label>
                <p className="text-sm text-muted-foreground">
                  {novaExcecao.aberto ? 'Sim, com horário especial' : 'Não, folga o dia todo'}
                </p>
              </div>
              <Switch
                checked={novaExcecao.aberto}
                onCheckedChange={(checked) => setNovaExcecao(prev => ({ ...prev, aberto: checked }))}
              />
            </div>

            {/* Horários (só se aberto) */}
            {novaExcecao.aberto && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      Início
                    </Label>
                    <Input
                      type="time"
                      value={novaExcecao.hora_abertura}
                      onChange={(e) => setNovaExcecao(prev => ({ ...prev, hora_abertura: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      Término
                    </Label>
                    <Input
                      type="time"
                      value={novaExcecao.hora_fechamento}
                      onChange={(e) => setNovaExcecao(prev => ({ ...prev, hora_fechamento: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Coffee className="h-3.5 w-3.5" />
                      Almoço início
                    </Label>
                    <Input
                      type="time"
                      value={novaExcecao.hora_almoco_inicio}
                      onChange={(e) => setNovaExcecao(prev => ({ ...prev, hora_almoco_inicio: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Coffee className="h-3.5 w-3.5" />
                      Almoço fim
                    </Label>
                    <Input
                      type="time"
                      value={novaExcecao.hora_almoco_fim}
                      onChange={(e) => setNovaExcecao(prev => ({ ...prev, hora_almoco_fim: e.target.value }))}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Motivo */}
            <div className="space-y-2">
              <Label>Motivo (opcional)</Label>
              <Textarea
                placeholder="Ex: Consulta médica, compromisso pessoal..."
                value={novaExcecao.motivo}
                onChange={(e) => setNovaExcecao(prev => ({ ...prev, motivo: e.target.value }))}
                rows={2}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddExcecao} disabled={saving} className="gap-2">
              {saving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Adicionar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
