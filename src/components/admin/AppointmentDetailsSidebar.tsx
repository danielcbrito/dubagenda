import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TimelineAppointment } from "./AdminAgenda";
import { AdminRescheduleModal } from "./AdminRescheduleModal";
import { 
  User, 
  Clock, 
  CreditCard, 
  Phone, 
  FileText, 
  CheckCircle2, 
  XCircle,
  History,
  AlertCircle,
  Edit
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
  const [clientPoints, setClientPoints] = useState<number>(0);
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);

  useEffect(() => {
    if (appointment) {
      loadHistory();
      loadClientPoints();
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

  const loadClientPoints = async () => {
    if (!appointment) return;

    try {
      const { data, error } = await supabase
        .from("pontos")
        .select("pontos")
        .eq("user_id", appointment.user_id)
        .maybeSingle();

      if (error) throw error;
      setClientPoints(data?.pontos || 0);
    } catch (error) {
      console.error("Error loading client points:", error);
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
  const paymentMethod = payment?.metodo || appointment.payment_method || 'cash';
  const isPrepaid = payment?.status === 'paid';
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
                {format(new Date(`${appointment.data}T12:00:00`), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
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
            <div className="pl-6 space-y-3">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {paymentMethod === 'pix' && 'PIX'}
                    {paymentMethod === 'card' && 'Cartão'}
                    {paymentMethod === 'cash' && 'Dinheiro'}
                  </Badge>
                  <Badge variant={isPrepaid ? "default" : "outline"} className={isPrepaid ? "bg-green-500 text-xs" : "text-xs"}>
                    {isPrepaid ? 'Pago Antecipadamente' : 'Pagar na Barbearia'}
                  </Badge>
                </div>
                <p className="text-sm font-medium">
                  Valor: R$ {appointment.preco.toFixed(2)}
                </p>
              </div>

              {appointment.is_free && (
                <div className="bg-green-500/10 border border-green-500/20 p-2 rounded">
                  <p className="text-xs text-green-700 dark:text-green-400 font-medium">
                    Usando Corte Grátis de Fidelidade
                  </p>
                </div>
              )}

              {!isPrepaid && appointment.status !== 'completed' && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 p-2 rounded">
                  <p className="text-xs text-yellow-700 dark:text-yellow-400">
                    Confirme o pagamento ao finalizar o atendimento
                  </p>
                </div>
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

          {/* Pontos de Fidelidade */}
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <CheckCircle2 className="w-4 h-4" />
              FIDELIDADE
            </div>
            <div className="pl-6 space-y-2">
              <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 p-3 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Pontos do Cliente</span>
                  <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                    {clientPoints}/5 pontos
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {clientPoints >= 5 
                    ? "Cliente pode resgatar 1 corte gratuito" 
                    : `Faltam ${5 - clientPoints} pontos para corte gratuito`}
                </p>
              </div>

              {appointment.ponto_liberado && (
                <div className="bg-green-500/10 border border-green-500/20 p-2 rounded">
                  <p className="text-xs text-green-700 dark:text-green-400">
                    Ponto já liberado para este atendimento
                  </p>
                </div>
              )}
            </div>
          </div>

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
                        {format(new Date(`${h.data}T12:00:00`), "dd/MM/yyyy")} às {h.hora}
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
                onClick={() => setRescheduleModalOpen(true)} 
                disabled={loading}
                variant="outline"
                className="w-full"
              >
                <Edit className="w-4 h-4 mr-2" />
                Remarcar / Cancelar
              </Button>
            )}
          </div>
        </div>
      </SheetContent>

      {/* Admin Reschedule Modal */}
      {appointment && (
        <AdminRescheduleModal
          open={rescheduleModalOpen}
          onOpenChange={setRescheduleModalOpen}
          appointmentId={appointment.id}
          userId={appointment.user_id}
          serviceName={appointment.servico?.nome || "Serviço"}
          currentDate={appointment.data}
          currentTime={appointment.hora}
          onSuccess={() => {
            setRescheduleModalOpen(false);
            onClose();
            onUpdate();
          }}
        />
      )}
    </Sheet>
  );
}
