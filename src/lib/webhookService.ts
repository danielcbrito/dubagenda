import { supabase } from "@/integrations/supabase/client";

interface WebhookEventData {
  evento: string;
  agendamento_id?: string;
  cliente_id?: string;
  cliente_nome?: string;
  cliente_telefone?: string;
  barbeiro_id?: string;
  servico?: string;
  data?: string;
  hora?: string;
  preco?: number;
  status?: string;
  mensagem_barbeiro?: string;
  mensagem?: string;
}

/**
 * Envia um evento para o webhook configurado
 * Não bloqueia o fluxo principal em caso de erro
 */
export async function sendWebhookEvent(eventData: WebhookEventData): Promise<void> {
  try {
    console.log('[webhookService] Enviando evento:', eventData.evento);
    
    const { data, error } = await supabase.functions.invoke('send-webhook-event', {
      body: {
        ...eventData,
        timestamp: new Date().toISOString()
      }
    });

    if (error) {
      console.error('[webhookService] Erro ao enviar evento:', error);
      return;
    }

    if (data?.success) {
      console.log('[webhookService] Evento enviado com sucesso:', eventData.evento);
    } else {
      console.warn('[webhookService] Webhook não configurado ou falhou:', data?.error);
    }
  } catch (error) {
    // Não propaga o erro para não bloquear o fluxo principal
    console.error('[webhookService] Erro inesperado:', error);
  }
}

/**
 * Evento: Novo agendamento criado pelo cliente
 */
export async function sendNovoAgendamentoEvent(data: {
  agendamento_id: string;
  cliente_id: string;
  cliente_nome: string;
  cliente_telefone?: string;
  servico: string;
  data: string;
  hora: string;
  preco: number;
}): Promise<void> {
  await sendWebhookEvent({
    evento: 'novo_agendamento',
    status: 'pendente',
    ...data
  });
}

/**
 * Evento: Barbeiro confirmou o agendamento
 */
export async function sendAgendamentoConfirmadoEvent(data: {
  agendamento_id: string;
  cliente_id: string;
  cliente_nome: string;
  servico: string;
  data: string;
  hora: string;
  preco: number;
}): Promise<void> {
  await sendWebhookEvent({
    evento: 'agendamento_confirmado',
    status: 'confirmado',
    ...data
  });
}

/**
 * Evento: Pagamento realizado
 */
export async function sendPagamentoRealizadoEvent(data: {
  agendamento_id: string;
  cliente_id: string;
  cliente_nome?: string;
  servico?: string;
  data?: string;
  hora?: string;
  preco: number;
}): Promise<void> {
  await sendWebhookEvent({
    evento: 'pagamento_realizado',
    status: 'pago',
    ...data
  });
}

/**
 * Evento: Agendamento cancelado
 */
export async function sendAgendamentoCanceladoEvent(data: {
  agendamento_id: string;
  cliente_id: string;
  cliente_nome?: string;
  servico?: string;
  data?: string;
  hora?: string;
  mensagem_barbeiro?: string;
}): Promise<void> {
  await sendWebhookEvent({
    evento: 'agendamento_cancelado',
    status: 'cancelado',
    ...data
  });
}

/**
 * Evento: Barbeiro solicitou remarcação
 */
export async function sendRemarcacaoSolicitadaEvent(data: {
  agendamento_id: string;
  cliente_id: string;
  cliente_nome?: string;
  servico?: string;
  data?: string;
  hora?: string;
  mensagem_barbeiro: string;
}): Promise<void> {
  await sendWebhookEvent({
    evento: 'remarcacao_solicitada',
    status: 'remarcacao_solicitada',
    ...data
  });
}

/**
 * Evento: Cliente concluiu a remarcação
 */
export async function sendRemarcacaoConcluidaEvent(data: {
  agendamento_id: string;
  cliente_id: string;
  cliente_nome?: string;
  servico?: string;
  data: string;
  hora: string;
  preco?: number;
}): Promise<void> {
  await sendWebhookEvent({
    evento: 'remarcacao_concluida',
    status: 'remarcado',
    ...data
  });
}
