import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  CheckCircle2, 
  Calendar,
  ArrowRight,
  Sparkles
} from 'lucide-react';

interface BarberSetupProps {
  barbeiroId: string;
  onComplete: () => void;
}

export function BarberSetup({ barbeiroId, onComplete }: BarberSetupProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleSkipGoogleCalendar = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('barbeiros')
        .update({ 
          setup_completed: true,
          google_calendar_connected: false 
        })
        .eq('id', barbeiroId);

      if (error) throw error;
      
      toast.success('Configuração concluída!');
      onComplete();
    } catch (error) {
      toast.error('Erro ao finalizar configuração');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGoogleCalendar = () => {
    // Por enquanto, apenas pular - a integração do Google Calendar pode ser implementada depois
    toast.info('Integração com Google Calendar em breve!');
    handleSkipGoogleCalendar();
  };

  const handleCompleteSetup = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('barbeiros')
        .update({ setup_completed: true })
        .eq('id', barbeiroId);

      if (error) throw error;
      
      toast.success('Bem-vindo ao seu painel!');
      onComplete();
    } catch (error) {
      toast.error('Erro ao finalizar configuração');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-lg bg-card/80 backdrop-blur-xl border-border/50">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Bem-vindo, Barbeiro!</CardTitle>
          <p className="text-muted-foreground mt-2">
            Vamos configurar seu painel em poucos passos
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {step === 1 && (
            <div className="space-y-6">
              {/* Step 1: Google Calendar */}
              <div className="p-6 rounded-xl bg-background/50 border border-border/30 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">Google Calendar</h3>
                    <p className="text-sm text-muted-foreground">
                      Sincronize sua agenda com o Google Calendar
                    </p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  Ao conectar seu Google Calendar, seus agendamentos aparecerão automaticamente no seu calendário pessoal.
                </p>

                <div className="flex gap-3">
                  <Button 
                    className="flex-1 gap-2"
                    onClick={handleConnectGoogleCalendar}
                    disabled={loading}
                  >
                    <Calendar className="h-4 w-4" />
                    Conectar
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setStep(2)}
                    disabled={loading}
                  >
                    Pular
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              {/* Step 2: Confirmation */}
              <div className="text-center space-y-4">
                <div className="mx-auto w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                </div>
                
                <div>
                  <h3 className="text-xl font-semibold text-foreground">Tudo pronto!</h3>
                  <p className="text-muted-foreground mt-2">
                    Seu painel está configurado. Agora você pode:
                  </p>
                </div>

                <ul className="text-left space-y-3 py-4">
                  <li className="flex items-center gap-3 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Ver e gerenciar seus agendamentos
                  </li>
                  <li className="flex items-center gap-3 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Acompanhar seu financeiro
                  </li>
                  <li className="flex items-center gap-3 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Configurar seus horários de trabalho
                  </li>
                </ul>

                <Button 
                  className="w-full gap-2"
                  onClick={handleCompleteSetup}
                  disabled={loading}
                >
                  Começar a usar
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Progress */}
          <div className="flex justify-center gap-2">
            <div className={`w-2 h-2 rounded-full transition-colors ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`w-2 h-2 rounded-full transition-colors ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
