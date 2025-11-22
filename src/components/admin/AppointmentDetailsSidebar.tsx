import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TimelineAppointment } from "./AdminAgenda";
import { 
  User, 
  Clock, 
  CreditCard, 
  Phone, 
  FileText, 
  CheckCircle2, 
  XCircle,
  History,
  AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useEffect } from "react";

interface AppointmentDetailsSidebarProps {
  appointment: TimelineAppointment | null;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export function AppointmentDetailsSidebar({ appointment, open, onClose, onUpdate }: AppointmentDetailsSidebarProps) {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (appointment) {
      loadHistory();
    }
  }, [appointment]);

  const loadHistory = async () => {
    if (!appointment) return;

    try {
      const { data, error } = await supabase
        .from("agendamentos")
        .select("data, hora, servico:servicos(nome), status")
        .eq("user_id", appointment.user_id)
        .neq("id", appointment.id)
        .order("data", { ascending: false })
        .order("hora", { ascending: false })
        .limit(5);

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error("Error loading history:", error);
    }
  };

  const handleMarkAsArrived = async () => {
    if (!appointment) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from("agendamentos")
        .update({ cliente_confirmou: true } as any)
        .eq("id", appointment.id);

      if (error) throw error;
      toast.success("Cliente marcado como presente");
      onUpdate();
    } catch (error) {
      console.error("Error marking arrival:", error);
      toast.error("Erro ao marcar presença");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsCompleted = async () => {
    if (!appointment) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from("agendamentos")
        .update({ 
          status: 'completed' as any,
          barbeiro_confirmou: true,
          ponto_liberado: true
        } as any)
        .eq("id", appointment.id);

      if (error) throw error;
      toast.success("Atendimento finalizado");
      onUpdate();
      onClose();
    } catch (error) {
      console.error("Error completing:", error);
      toast.error("Erro ao finalizar");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!appointment) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from("agendamentos")
        .update({ status: 'cancelled_by_admin' as any } as any)
        .eq("id", appointment.id);

      if (error) throw error;
      toast.success("Agendamento cancelado");
      onUpdate();
      onClose();
    } catch (error) {
      console.error("Error canceling:", error);
      toast.error("Erro ao cancelar");
    } finally {
      setLoading(false);
    }
  };

  if (!appointment) return null;

  const payment = appointment.pagamentos?.[0];
  const canComplete = appointment.status !== 'completed' && appointment.status !== 'cancelled_by_admin';
  const canCancel = appointment.status !== 'completed' && appointment.status !== 'cancelled_by_admin' && appointment.status !== 'cancelled_by_user';

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Detalhes do Agendamento</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Cliente */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <User className="w-4 h-4" />
              CLIENTE
            </div>
            <div className="pl-6">
              <p className="font-semibold text-lg">{appointment.profile?.nome || "Nome não disponível"}</p>
              {appointment.profile?.cpf && (
                <p className="text-sm text-muted-foreground">CPF: {appointment.profile.cpf}</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Serviço */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <FileText className="w-4 h-4" />
              SERVIÇO
            </div>
            <div className="pl-6 space-y-2">
              <p className="font-semibold">{appointment.servico?.nome || "Serviço"}</p>
              <div className="flex items-center gap-4 text-sm">
                <Badge variant="outline">
                  <Clock className="w-3 h-3 mr-1" />
                  {appointment.servico?.duracao_minutos || 0} minutos
                </Badge>
                <Badge variant="outline">
                  <CreditCard className="w-3 h-3 mr-1" />
                  R$ {appointment.preco.toFixed(2)}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Horário */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Clock className="w-4 h-4" />
              HORÁRIO
            </div>
            <div className="pl-6">
              <p className="font-semibold">
                {format(new Date(appointment.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
              <p className="text-2xl font-bold text-primary">{appointment.hora}</p>
            </div>
          </div>

          <Separator />

          {/* Pagamento */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <CreditCard className="w-4 h-4" />
              PAGAMENTO
            </div>
            <div className="pl-6 space-y-2">
              {payment ? (
                <>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={
                      payment.status === 'paid' 
                        ? "bg-green-500/20 text-green-600" 
                        : payment.status === 'pending'
                        ? "bg-yellow-500/20 text-yellow-600"
                        : "bg-red-500/20 text-red-600"
                    }>
                      {payment.status === 'paid' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                      {payment.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                      {payment.status === 'failed' && <AlertCircle className="w-3 h-3 mr-1" />}
                      {payment.status === 'paid' ? 'Pago' : payment.status === 'pending' ? 'Pendente' : 'Falhou'}
                    </Badge>
                    <Badge variant="outline">
                      {payment.metodo === 'pix' ? 'PIX' : payment.metodo === 'card' ? 'Cartão' : 'Dinheiro'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Valor: R$ {payment.valor.toFixed(2)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Sem informação de pagamento</p>
              )}
            </div>
          </div>

          {appointment.observacoes && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <FileText className="w-4 h-4" />
                  OBSERVAÇÕES
                </div>
                <div className="pl-6">
                  <p className="text-sm">{appointment.observacoes}</p>
                </div>
              </div>
            </>
          )}

          {/* Confirmações */}
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <CheckCircle2 className="w-4 h-4" />
              STATUS
            </div>
            <div className="pl-6 space-y-2">
              <div className="flex items-center gap-2">
                {appointment.cliente_confirmou ? (
                  <Badge className="bg-green-500">Cliente confirmou presença</Badge>
                ) : (
                  <Badge variant="outline">Cliente não confirmou</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {appointment.barbeiro_confirmou ? (
                  <Badge className="bg-green-500">Barbeiro confirmou</Badge>
                ) : (
                  <Badge variant="outline">Aguardando barbeiro</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Histórico */}
          {history.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <History className="w-4 h-4" />
                  HISTÓRICO DO CLIENTE
                </div>
                <div className="pl-6 space-y-2">
                  {history.map((h, i) => (
                    <div key={i} className="text-sm">
                      <span className="text-muted-foreground">
                        {format(new Date(h.data), "dd/MM/yyyy")} às {h.hora}
                      </span>
                      {" - "}
                      <span>{h.servico?.nome}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Ações */}
          <Separator />
          <div className="space-y-3">
            {!appointment.cliente_confirmou && canComplete && (
              <Button 
                onClick={handleMarkAsArrived} 
                disabled={loading}
                className="w-full"
                variant="outline"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Marcar como Chegou
              </Button>
            )}
            
            {canComplete && (
              <Button 
                onClick={handleMarkAsCompleted} 
                disabled={loading}
                className="w-full"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Marcar como Finalizado
              </Button>
            )}
            
            {canCancel && (
              <Button 
                onClick={handleCancel} 
                disabled={loading}
                variant="destructive"
                className="w-full"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Cancelar Agendamento
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
