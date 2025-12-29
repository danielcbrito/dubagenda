import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, X, Clock, User, Scissors } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BarberConfirmacoesProps {
  barbeiroId: string;
}

export function BarberConfirmacoes({ barbeiroId }: BarberConfirmacoesProps) {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPending();
    const channel = supabase
      .channel('barber-confirmacoes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos', filter: `barbeiro_id=eq.${barbeiroId}` }, () => loadPending())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [barbeiroId]);

  const loadPending = async () => {
    const { data } = await supabase
      .from('agendamentos')
      .select('*, profiles(nome), servicos(nome)')
      .eq('barbeiro_id', barbeiroId)
      .eq('status', 'pending')
      .eq('barbeiro_confirmou', false)
      .order('data', { ascending: true });
    setAppointments(data || []);
    setLoading(false);
  };

  const handleConfirm = async (id: string) => {
    await supabase.from('agendamentos').update({ barbeiro_confirmou: true, status: 'confirmed' }).eq('id', id);
    toast.success('Confirmado!');
  };

  const handleReject = async (id: string) => {
    await supabase.from('agendamentos').update({ status: 'cancelled_by_admin' }).eq('id', id);
    toast.success('Cancelado');
  };

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Confirmações Pendentes</h1>
      {appointments.length === 0 ? (
        <Card className="bg-card/50 border-border/50"><CardContent className="py-12 text-center"><CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" /><p className="text-muted-foreground">Nenhuma confirmação pendente</p></CardContent></Card>
      ) : (
        <div className="grid gap-4">{appointments.map((apt) => (
          <Card key={apt.id} className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2"><Scissors className="h-4 w-4 text-primary" /><span className="font-medium">{apt.servicos?.nome}</span></div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><User className="h-4 w-4" />{apt.profiles?.nome}</div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><Clock className="h-4 w-4" />{format(new Date(apt.data), "dd/MM", { locale: ptBR })} às {apt.hora}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleConfirm(apt.id)}><CheckCircle className="h-4 w-4 mr-1" />Confirmar</Button>
                  <Button size="sm" variant="outline" onClick={() => handleReject(apt.id)}><X className="h-4 w-4" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}</div>
      )}
    </div>
  );
}
