import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.23.8';

const BodySchema = z.object({
  appointmentId: z.string().uuid(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/),
  duracao: z.number().int().min(5).max(600).optional(),
  dryRun: z.boolean().optional(),
});

type SupabaseClient = ReturnType<typeof createClient>;

interface BusinessHoursConfig {
  aberto: boolean;
  hora_abertura: string;
  hora_fechamento: string;
  hora_almoco_inicio: string | null;
  hora_almoco_fim: string | null;
  delay_entre_servicos: number;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeTime(value: string | null | undefined): string {
  if (!value) return '';
  const [hours = '00', minutes = '00'] = value.split(':');
  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = normalizeTime(time).split(':').map(Number);
  return hours * 60 + minutes;
}

function formatDatePtBR(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

function buildRescheduleMessage(params: {
  clienteNome?: string | null;
  servico?: string | null;
  data: string;
  hora: string;
}) {
  const nome = params.clienteNome?.split(' ')[0] || 'Cliente';
  const servico = params.servico || 'serviço';
  return `🔄 *Agendamento Remarcado!*\nOlá ${nome}! Seu ${servico} foi remarcado com sucesso para o dia ${formatDatePtBR(params.data)} às ${normalizeTime(params.hora)}.\nNos vemos em breve! 💈`;
}

async function resolveBusinessHours(
  supabase: SupabaseClient,
  date: string,
  barberId: string,
): Promise<BusinessHoursConfig> {
  const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
  let configData: any = null;

  const { data: barberException } = await supabase
    .from('horarios_excepcionais_barbeiro')
    .select('*')
    .eq('barbeiro_id', barberId)
    .eq('data', date)
    .maybeSingle();

  configData = barberException;

  if (!configData) {
    const { data: globalException } = await supabase
      .from('horarios_excepcionais')
      .select('*')
      .eq('data', date)
      .maybeSingle();
    configData = globalException;
  }

  if (!configData) {
    const { data: barberConfig } = await supabase
      .from('configuracoes_horario_barbeiro')
      .select('*')
      .eq('barbeiro_id', barberId)
      .eq('dia_semana', dayOfWeek)
      .maybeSingle();
    if (barberConfig && barberConfig.aberto !== null) configData = barberConfig;
  }

  if (!configData) {
    const { data: globalConfig } = await supabase
      .from('configuracoes_horario')
      .select('*')
      .eq('dia_semana', dayOfWeek)
      .maybeSingle();
    configData = globalConfig;
  }

  return configData
    ? {
        aberto: configData.aberto ?? true,
        hora_abertura: configData.hora_abertura || '09:00',
        hora_fechamento: configData.hora_fechamento || '21:00',
        hora_almoco_inicio: configData.hora_almoco_inicio,
        hora_almoco_fim: configData.hora_almoco_fim,
        delay_entre_servicos: configData.delay_entre_servicos || 10,
      }
    : {
        aberto: dayOfWeek !== 0,
        hora_abertura: '09:00',
        hora_fechamento: '21:00',
        hora_almoco_inicio: '13:00',
        hora_almoco_fim: '14:00',
        delay_entre_servicos: 10,
      };
}

async function validateAvailability(params: {
  supabase: SupabaseClient;
  appointmentId: string;
  data: string;
  hora: string;
  duracao: number;
  barberId: string;
}): Promise<{ valid: boolean; message: string }> {
  const { supabase, appointmentId, data, hora, duracao, barberId } = params;
  const config = await resolveBusinessHours(supabase, data, barberId);

  if (!config.aberto) {
    return { valid: false, message: 'A barbearia não funciona neste dia.' };
  }

  const startTimeInMinutes = timeToMinutes(hora);
  const endTimeInMinutes = startTimeInMinutes + duracao;
  const openMinutes = timeToMinutes(config.hora_abertura);
  const closeMinutes = timeToMinutes(config.hora_fechamento);
  const lunchStart = config.hora_almoco_inicio ? timeToMinutes(config.hora_almoco_inicio) : null;
  const lunchEnd = config.hora_almoco_fim ? timeToMinutes(config.hora_almoco_fim) : null;

  if (startTimeInMinutes < openMinutes || endTimeInMinutes > closeMinutes) {
    return {
      valid: false,
      message: `Horário fora do expediente. Funcionamento: ${config.hora_abertura} às ${config.hora_fechamento}.`,
    };
  }

  if (
    lunchStart !== null &&
    lunchEnd !== null &&
    startTimeInMinutes < lunchEnd &&
    endTimeInMinutes > lunchStart
  ) {
    return {
      valid: false,
      message: `Horário indisponível. A barbearia está fechada para almoço entre ${config.hora_almoco_inicio} e ${config.hora_almoco_fim}.`,
    };
  }

  const { data: existingAppointments, error: appointmentError } = await supabase
    .from('agendamentos')
    .select('id, hora, duracao, status')
    .eq('data', data)
    .eq('barbeiro_id', barberId)
    .in('status', ['pending', 'confirmed', 'completed'])
    .neq('id', appointmentId);

  if (appointmentError) {
    console.error('[reschedule-appointment-client] Erro ao buscar agendamentos:', appointmentError);
    return { valid: false, message: 'Erro ao verificar disponibilidade.' };
  }

  const delayMinutes = config.delay_entre_servicos;

  for (const appointment of existingAppointments || []) {
    const appointmentStart = timeToMinutes(appointment.hora);
    const appointmentEndWithDelay = appointmentStart + appointment.duracao + delayMinutes;
    const hasConflict = startTimeInMinutes < appointmentEndWithDelay && endTimeInMinutes > appointmentStart;

    if (hasConflict) {
      return { valid: false, message: 'Horário indisponível. Já existe um agendamento nesse período.' };
    }
  }

  const { data: pendingBookings, error: pendingError } = await supabase
    .from('pending_bookings')
    .select('id, hora, duracao')
    .eq('data', data)
    .eq('barbeiro_id', barberId)
    .gt('expires_at', new Date().toISOString());

  if (pendingError) {
    console.warn('[reschedule-appointment-client] Erro ao buscar pending_bookings:', pendingError);
  }

  for (const pending of pendingBookings || []) {
    const pendingStart = timeToMinutes(pending.hora);
    const pendingEndWithDelay = pendingStart + pending.duracao + delayMinutes;
    const hasConflict = startTimeInMinutes < pendingEndWithDelay && endTimeInMinutes > pendingStart;

    if (hasConflict) {
      return { valid: false, message: 'Horário temporariamente reservado. Tente outro horário ou aguarde alguns minutos.' };
    }
  }

  return { valid: true, message: 'Horário disponível' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Token de autenticação ausente' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return jsonResponse({ error: 'Usuário não autenticado' }, 401);
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return jsonResponse({ error: parsed.error.flatten().fieldErrors }, 400);
    }

    const { appointmentId, data, duracao, dryRun } = parsed.data;
    const hora = normalizeTime(parsed.data.hora);
    const userId = userData.user.id;

    const { data: appointment, error: appointmentError } = await supabase
      .from('agendamentos')
      .select(`
        id, user_id, barbeiro_id, servico_id, data, hora, duracao, status, preco, payment_method,
        servicos:servico_id (nome),
        barbeiros:barbeiro_id (apelido, tenant_id)
      `)
      .eq('id', appointmentId)
      .single();

    if (appointmentError || !appointment) {
      return jsonResponse({ error: 'Agendamento não encontrado' }, 404);
    }

    if (appointment.user_id !== userId) {
      return jsonResponse({ error: 'Sem permissão para remarcar este agendamento' }, 403);
    }

    if (!['pending', 'confirmed'].includes(appointment.status)) {
      return jsonResponse({ error: `Agendamento com status '${appointment.status}' não pode ser remarcado` }, 400);
    }

    if (!appointment.barbeiro_id) {
      return jsonResponse({ error: 'Agendamento sem profissional vinculado não pode ser remarcado' }, 400);
    }

    const durationToUse = duracao ?? appointment.duracao;
    const availability = await validateAvailability({
      supabase,
      appointmentId,
      data,
      hora,
      duracao: durationToUse,
      barberId: appointment.barbeiro_id,
    });

    if (!availability.valid) {
      return jsonResponse({ error: availability.message, code: 'TIME_SLOT_UNAVAILABLE' }, 409);
    }

    if (dryRun) {
      return jsonResponse({ success: true, valid: true, message: availability.message });
    }

    const previousDate = appointment.data;
    const previousTime = normalizeTime(appointment.hora);

    const { data: updatedAppointment, error: updateError } = await supabase
      .from('agendamentos')
      .update({
        data,
        hora,
        duracao: durationToUse,
        status: 'confirmed',
        barbeiro_confirmou: true,
        cliente_confirmou: true,
        remarcacao_solicitada: false,
        motivo_remarcacao: null,
        visivel_para_usuario: true,
      })
      .eq('id', appointmentId)
      .select('id, data, hora, duracao, status, updated_at')
      .single();

    if (updateError) {
      console.error('[reschedule-appointment-client] Erro ao atualizar agendamento:', updateError);
      return jsonResponse({ error: 'Erro ao remarcar agendamento' }, 500);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('nome, telefone')
      .eq('id', userId)
      .maybeSingle();

    const serviceName = Array.isArray(appointment.servicos)
      ? appointment.servicos[0]?.nome
      : appointment.servicos?.nome;
    const barber = Array.isArray(appointment.barbeiros) ? appointment.barbeiros[0] : appointment.barbeiros;
    const message = buildRescheduleMessage({
      clienteNome: profile?.nome || userData.user.email,
      servico: serviceName,
      data,
      hora,
    });

    let notificationResult: Record<string, unknown> | null = null;
    try {
      const webhookResponse = await fetch(`${supabaseUrl}/functions/v1/send-webhook-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          evento: 'remarcacao_concluida',
          descricao: 'Cliente concluiu a remarcação do agendamento',
          status: 'remarcado',
          agendamento_id: appointmentId,
          data,
          hora,
          duracao_minutos: durationToUse,
          servico_id: appointment.servico_id,
          servico: serviceName || 'Serviço',
          valor_total: appointment.preco,
          preco: appointment.preco,
          cliente_id: userId,
          cliente_nome: profile?.nome || userData.user.email || 'Cliente',
          cliente_telefone: profile?.telefone || null,
          cliente_email: userData.user.email || null,
          barbeiro_id: appointment.barbeiro_id,
          barbeiro_nome: barber?.apelido || null,
          mensagem: message,
          detalhes: {
            tenant_id: barber?.tenant_id || null,
            data_anterior: previousDate,
            hora_anterior: previousTime,
          },
        }),
      });

      notificationResult = await webhookResponse.json().catch(() => null);
      if (!webhookResponse.ok || notificationResult?.success === false) {
        console.warn('[reschedule-appointment-client] Notificação de remarcação não confirmada:', notificationResult);
      }
    } catch (notificationError) {
      console.warn('[reschedule-appointment-client] Falha ao enviar webhook de remarcação:', notificationError);
    }

    return jsonResponse({
      success: true,
      appointment: updatedAppointment,
      notification: notificationResult,
    });
  } catch (error) {
    console.error('[reschedule-appointment-client] Erro:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Erro interno' }, 500);
  }
});