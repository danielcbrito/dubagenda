import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Calendar as CalendarIcon, Clock, User } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { sendAgendamentoConfirmadoEvent, sendAgendamentoCanceladoEvent } from "@/lib/webhookService";
import { useBarbeiroLogado } from "@/hooks/useBarbeiroLogado";

interface PendingAppointment {
  id: string;
  data: string;
  hora: string;
  status: string;
  preco: number;
  cliente_confirmou: boolean;
  barbeiro_confirmou: boolean;
  payment_method: string | null;
  remarcado_de: string | null;
  tipo_agendamento: string | null;
  is_free: boolean | null;
  profile: { nome: string } | null;
  servico: { nome: string } | null;
  payment: { metodo: string; status: string } | null;
}

export function AdminConfirmacoesPendentes() {
  const [appointments, setAppointments] = useState<PendingAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Hook para obter o barbeiro logado
  const { barbeiroId, loading: loadingBarbeiro } = useBarbeiroLogado();

  useEffect(() => {
    loadPending();

    const channel = supabase
      .channel('admin-confirmacoes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' }, () => {
        loadPending();
      })
      .subscribe();

    // Fallback polling every 20 seconds
    const pollingInterval = setInterval(() => {
      loadPending();
    }, 20000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollingInterval);
    };
  }, [barbeiroId, loadingBarbeiro]);

  const loadPending = async () => {
    // Aguardar o barbeiro_id estar disponível
    if (loadingBarbeiro) return;
    
    setLoading(true);
    try {
      // Construir query com filtro por barbeiro
      let query = supabase
        .from("agendamentos")
        .select("id, data, hora, status, preco, cliente_confirmou, barbeiro_confirmou, user_id, servico_id, payment_method, remarcado_de, tipo_agendamento, is_free, barbeiro_id")
        .eq("status", "pending")
        .eq("barbeiro_confirmou", false)
        .order("data", { ascending: true })
        .order("hora", { ascending: true });

      // FILTRO CRÍTICO: Se o usuário é um barbeiro, mostrar APENAS seus agendamentos
      if (barbeiroId) {
        query = query.eq("barbeiro_id", barbeiroId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const appointmentsWithDetails = await Promise.all(
        (data || []).map(async (apt) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("nome")
            .eq("id", apt.user_id)
            .single();

          const { data: servico } = await supabase
            .from("servicos")
            .select("nome")
            .eq("id", apt.servico_id)
            .single();

          const { data: payment } = await supabase
            .from("pagamentos")
            .select("metodo, status")
            .eq("agendamento_id", apt.id)
            .maybeSingle();

          return {
            ...apt,
            profile: profile || null,
            servico: servico || null,
            payment: payment || null,
          };
        })
      );

      setAppointments(appointmentsWithDetails);
    } catch (error) {
      console.error("Error loading pending confirmations:", error);
      toast.error("Erro ao carregar confirmações pendentes");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (appointmentId: string) => {
    try {
      // Buscar dados do agendamento primeiro para log
      const appointmentToConfirm = appointments.find(a => a.id === appointmentId);
      
      console.log("🔄 Confirmando agendamento:", {
        id: appointmentId,
        servico: appointmentToConfirm?.servico?.nome,
        hora: appointmentToConfirm?.hora,
        cliente: appointmentToConfirm?.profile?.nome
      });
      
      const { error, data } = await supabase
        .from("agendamentos")
        .update({ 
          barbeiro_confirmou: true, 
          status: 'confirmed',
          updated_at: new Date().toISOString()
        })
        .eq("id", appointmentId)
        .select("*, user_id")
        .single();

      if (error) {
        console.error("❌ Erro ao confirmar:", error);
        throw error;
      }

      console.log("✅ Agendamento confirmado com sucesso:", {
        id: data.id,
        status: data.status,
        barbeiro_confirmou: data.barbeiro_confirmou,
        hora: data.hora,
        data: data.data
      });

      // Enviar evento para webhook
      sendAgendamentoConfirmadoEvent({
        agendamento_id: appointmentId,
        cliente_id: data.user_id,
        cliente_nome: appointmentToConfirm?.profile?.nome || "Cliente",
        servico: appointmentToConfirm?.servico?.nome || "Serviço",
        data: data.data,
        hora: data.hora,
        preco: data.preco
      });

      // Criar notificação para o cliente
      const { error: notifError } = await supabase
        .from("notificacoes")
        .insert({
          user_id: data.user_id,
          agendamento_id: appointmentId,
          titulo: "Agendamento Confirmado ✓",
          mensagem: `Seu agendamento para ${appointmentToConfirm?.servico?.nome || 'serviço'} no dia ${data.data.split('-').reverse().slice(0,2).join('/')} às ${data.hora.substring(0,5)} foi confirmado pelo barbeiro. Te esperamos!`,
          tipo: "geral",
          lida: false
        });

      if (notifError) {
        console.error("Erro ao criar notificação:", notifError);
      }
      
      toast.success(
        `✅ Agendamento aprovado! Agora aparecerá na agenda: ${appointmentToConfirm?.servico?.nome || 'Serviço'} às ${appointmentToConfirm?.hora || ''}`
      );
      
      // Atualizar lista local imediatamente
      setAppointments(prev => prev.filter(a => a.id !== appointmentId));
      
      // Recarregar para garantir sincronização
      setTimeout(() => loadPending(), 300);
    } catch (error) {
      console.error("❌ Erro ao confirmar atendimento:", error);
      toast.error("Erro ao confirmar atendimento");
    }
  };

  const handleReject = async (appointmentId: string) => {
    try {
      const appointmentToReject = appointments.find(a => a.id === appointmentId);

      const { data, error } = await supabase
        .from("agendamentos")
        .update({ 
          status: 'cancelled_by_admin' as any,
          visivel_para_usuario: false
        } as any)
        .eq("id", appointmentId)
        .select("user_id")
        .single();

      if (error) throw error;

      // Enviar evento para webhook
      sendAgendamentoCanceladoEvent({
        agendamento_id: appointmentId,
        cliente_id: data.user_id,
        cliente_nome: appointmentToReject?.profile?.nome,
        servico: appointmentToReject?.servico?.nome,
        data: appointmentToReject?.data,
        hora: appointmentToReject?.hora,
        mensagem_barbeiro: "Agendamento recusado pelo barbeiro"
      });
      
      toast.success("Agendamento recusado. Cliente será notificado.");
      
      setAppointments(prev => prev.filter(a => a.id !== appointmentId));
      loadPending();
    } catch (error) {
      console.error("Error rejecting appointment:", error);
      toast.error("Erro ao recusar atendimento");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Confirmações Pendentes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Todos os agendamentos precisam ser aprovados antes de entrar na agenda
        </p>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      ) : appointments.length === 0 ? (
        <Card className="p-12 text-center">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">Nenhuma confirmação pendente no momento</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {appointments.map((apt) => {
            const paymentMethod = apt.payment?.metodo || apt.payment_method || 'cash';
            const isPrepaid = apt.payment?.status === 'paid';
            const isPlano = apt.tipo_agendamento === 'plano' || apt.payment_method === 'plano';
            const isCredit = apt.payment_method === 'credit';
            
            // Determinar cor da borda baseado no método de pagamento
            // Amarelo/Laranja = Pagar na barbearia
            // Verde = Já pagou (PIX/Cartão)
            // Roxo = Crédito do app
            // Azul = Plano
            let borderColor = 'border-l-yellow-500'; // Default: pagar na barbearia
            if (isPlano) {
              borderColor = 'border-l-blue-500';
            } else if (isCredit) {
              borderColor = 'border-l-purple-500';
            } else if (isPrepaid) {
              borderColor = 'border-l-green-500';
            }
            
            return (
              <Card key={apt.id} className={`p-6 border-l-4 ${borderColor}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold">{apt.servico?.nome || "Serviço"}</h3>
                      <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-500/20">
                        Aguardando Aprovação
                      </Badge>
                      {apt.remarcado_de && (
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-500/20">
                          Remarcado
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-3">
                      <span className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        {apt.profile?.nome || "Cliente"}
                      </span>
                      <span className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4" />
                        {format(new Date(`${apt.data}T12:00:00`), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                      <span className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {apt.hora}
                      </span>
                    </div>

                    {/* Forma de Pagamento - Cores: Amarelo=Barbearia, Verde=Pago, Roxo=Crédito, Azul=Plano */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      <Badge variant="outline" className="text-xs">
                        {isPlano ? 'Incluído no Plano' : apt.is_free ? 'Corte Grátis' : `Valor: R$ ${apt.preco.toFixed(2)}`}
                      </Badge>
                      
                      {/* PLANO - Azul */}
                      {isPlano && (
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-500/20 font-semibold">
                          🎫 PLANO
                        </Badge>
                      )}
                      
                      {/* CRÉDITO APP - Roxo */}
                      {isCredit && !isPlano && (
                        <Badge variant="outline" className="bg-purple-500/10 text-purple-700 border-purple-500/20 font-semibold">
                          💳 CRÉDITO APP
                        </Badge>
                      )}
                      
                      {/* PIX/CARTÃO PAGO - Verde */}
                      {(paymentMethod === 'pix' || paymentMethod === 'card') && isPrepaid && !isPlano && !isCredit && (
                        <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20 font-semibold">
                          ✓ PAGO NO APP
                        </Badge>
                      )}
                      
                      {/* PIX/CARTÃO PENDENTE - Amarelo */}
                      {(paymentMethod === 'pix' || paymentMethod === 'card') && !isPrepaid && !isPlano && !isCredit && (
                        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-500/20">
                          Pagamento Pendente
                        </Badge>
                      )}
                      
                      {/* PAGAR NA BARBEARIA - Amarelo */}
                      {(paymentMethod === 'cash' || paymentMethod === 'barbearia') && !isPlano && !isCredit && (
                        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-500/20 font-semibold">
                          💰 PAGAR NA BARBEARIA
                        </Badge>
                      )}
                    </div>

                    <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-lg">
                      <p className="text-xs text-yellow-700 dark:text-yellow-400">
                        Este agendamento aparecerá na agenda após aprovação
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 min-w-[120px]"
                      onClick={() => handleConfirm(apt.id)}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Aprovar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="min-w-[120px]"
                      onClick={() => handleReject(apt.id)}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Recusar
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
