import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Converte HH:MM para minutos totais
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Verifica disponibilidade do horário de forma atômica
 * Usa configurações do banco de dados
 */
async function checkTimeSlotAvailability(
  supabase: any,
  data: string,
  hora: string,
  duracao: number,
  excludeAppointmentId?: string,
  barbeiro_id?: string | null
): Promise<{ available: boolean; message: string }> {
  
  console.log('[checkTimeSlotAvailability] Verificando:', { data, hora, duracao, excludeAppointmentId, barbeiro_id });
  
  const [startHour, startMinute] = hora.split(':').map(Number);
  const startTimeInMinutes = startHour * 60 + startMinute;
  const endTimeInMinutes = startTimeInMinutes + duracao;

  const appointmentDate = new Date(data + 'T12:00:00');
  const dayOfWeek = appointmentDate.getDay();
  let tenantId: string | null = null;

  if (barbeiro_id) {
    const { data: barberScope } = await supabase
      .from('barbeiros')
      .select('tenant_id')
      .eq('id', barbeiro_id)
      .maybeSingle();
    tenantId = barberScope?.tenant_id ?? null;
  }

  // Buscar configurações de horário com hierarquia completa:
  // 1) Exceção do barbeiro, 2) Exceção global, 3) Config barbeiro, 4) Config global
  let config: any = null;
  let configSource = 'padrão global';

  if (barbeiro_id) {
    // 1) Exceção do barbeiro para a data específica
    const { data: excBarbeiro } = await supabase
      .from('horarios_excepcionais_barbeiro')
      .select('*')
      .eq('barbeiro_id', barbeiro_id)
      .eq('data', data)
      .maybeSingle();
    if (excBarbeiro) { config = excBarbeiro; configSource = 'exceção barbeiro'; }
  }

  if (!config) {
    // 2) Exceção global para a data específica
    let globalExceptionQuery = supabase
      .from('horarios_excepcionais')
      .select('*')
      .eq('data', data);
    if (tenantId) globalExceptionQuery = globalExceptionQuery.eq('tenant_id', tenantId);
    const { data: excGlobal } = await globalExceptionQuery.maybeSingle();
    if (excGlobal) { config = excGlobal; configSource = 'exceção global'; }
  }

  if (!config && barbeiro_id) {
    // 3) Config padrão do barbeiro
    const { data: barbeiroConfig } = await supabase
      .from('configuracoes_horario_barbeiro')
      .select('*')
      .eq('barbeiro_id', barbeiro_id)
      .eq('dia_semana', dayOfWeek)
      .maybeSingle();
    if (barbeiroConfig) { config = barbeiroConfig; configSource = 'config barbeiro'; }
  }

  if (!config) {
    // 4) Config global
    const { data: globalConfig } = await supabase
      .from('configuracoes_horario')
      .select('*')
      .eq('dia_semana', dayOfWeek)
      .maybeSingle();

    config = globalConfig || {
      aberto: dayOfWeek !== 0,
      hora_abertura: '09:00',
      hora_fechamento: '21:00',
      hora_almoco_inicio: '13:00',
      hora_almoco_fim: '14:00',
      delay_entre_servicos: 10
    };
    if (globalConfig) configSource = 'config global';
  }

  console.log(`[checkTimeSlotAvailability] Config dia ${dayOfWeek} (${configSource}${barbeiro_id ? `, barbeiro: ${barbeiro_id}` : ''}): ${config.hora_abertura}-${config.hora_fechamento}`);

  if (!config.aberto) {
    return { available: false, message: 'A barbearia não funciona neste dia.' };
  }

  const OPEN_MINUTES = timeToMinutes(config.hora_abertura);
  const CLOSE_MINUTES = timeToMinutes(config.hora_fechamento);
  const LUNCH_START = config.hora_almoco_inicio ? timeToMinutes(config.hora_almoco_inicio) : null;
  const LUNCH_END = config.hora_almoco_fim ? timeToMinutes(config.hora_almoco_fim) : null;

  if (startTimeInMinutes < OPEN_MINUTES || endTimeInMinutes > CLOSE_MINUTES) {
    return { available: false, message: `Horário fora do expediente (${config.hora_abertura}-${config.hora_fechamento}).` };
  }

  if (LUNCH_START !== null && LUNCH_END !== null) {
    if (
      (startTimeInMinutes >= LUNCH_START && startTimeInMinutes < LUNCH_END) ||
      (endTimeInMinutes > LUNCH_START && endTimeInMinutes <= LUNCH_END) ||
      (startTimeInMinutes < LUNCH_START && endTimeInMinutes > LUNCH_END)
    ) {
      return { available: false, message: `Horário de almoço (${config.hora_almoco_inicio}-${config.hora_almoco_fim}).` };
    }
  }

  // Sem intervalo entre serviços: próximo horário disponível = fim do serviço anterior
  const DELAY_MINUTES = 0;
  
  // Verificar conflitos com agendamentos existentes
  let query = supabase
    .from('agendamentos')
    .select('id, hora, duracao, status')
    .eq('data', data)
    .in('status', ['pending', 'confirmed', 'completed']);

  if (barbeiro_id) {
    query = query.eq('barbeiro_id', barbeiro_id);
  }

  if (excludeAppointmentId) {
    query = query.neq('id', excludeAppointmentId);
  }

  const { data: existingAppointments, error: aptError } = await query;

  if (aptError) {
    console.error('[checkTimeSlotAvailability] Erro:', aptError);
    return { available: false, message: 'Erro ao verificar disponibilidade.' };
  }

  for (const apt of existingAppointments || []) {
    const [aptHour, aptMinute] = apt.hora.split(':').map(Number);
    const aptStart = aptHour * 60 + aptMinute;
    const aptEnd = aptStart + apt.duracao;
    const aptEndWithDelay = aptEnd + DELAY_MINUTES;

    if (startTimeInMinutes < aptEndWithDelay && endTimeInMinutes > aptStart) {
      return { 
        available: false, 
        message: 'Horário indisponível. Já existe um agendamento nesse período.' 
      };
    }
  }

  // Verificar pending bookings (filtrado por barbeiro para isolamento multi-tenant)
  let pendingQuery = supabase
    .from('pending_bookings')
    .select('id, hora, duracao')
    .eq('data', data)
    .gt('expires_at', new Date().toISOString());
  if (barbeiro_id) pendingQuery = pendingQuery.eq('barbeiro_id', barbeiro_id);

  const { data: pendingBookings } = await pendingQuery;

  for (const pending of pendingBookings || []) {
    const [pendingHour, pendingMinute] = pending.hora.split(':').map(Number);
    const pendingStart = pendingHour * 60 + pendingMinute;
    const pendingEnd = pendingStart + pending.duracao;
    const pendingEndWithDelay = pendingEnd + DELAY_MINUTES;

    if (startTimeInMinutes < pendingEndWithDelay && endTimeInMinutes > pendingStart) {
      return { 
        available: false, 
        message: 'Horário temporariamente reservado. Tente novamente em alguns minutos.' 
      };
    }
  }

  return { available: true, message: 'Horário disponível' };
}

interface CreatePaymentRequest {
  bookingData: {
    servico_id: string;
    barbeiro_id: string | null;
    data: string;
    hora: string;
    duracao: number;
    preco: number;
    observacoes?: string;
  };
  metodo: 'cash' | 'wallet';
  rescheduleFromId?: string;
  creditsUsed?: number;
  consumeRedemptionOnPaidBooking?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { bookingData, metodo, rescheduleFromId, consumeRedemptionOnPaidBooking }: CreatePaymentRequest = await req.json();

    console.log('[create-payment] Request:', { bookingData, metodo, isRescheduling: !!rescheduleFromId });

    // Verificação atômica de disponibilidade
    const availability = await checkTimeSlotAvailability(
      supabase,
      bookingData.data,
      bookingData.hora,
      bookingData.duracao,
      rescheduleFromId,
      bookingData.barbeiro_id
    );

    if (!availability.available) {
      return new Response(
        JSON.stringify({ error: availability.message, code: 'TIME_SLOT_UNAVAILABLE' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cancelar agendamento anterior (remarcação)
    if (rescheduleFromId) {
      await supabase
        .from('agendamentos')
        .update({ status: 'cancelled_by_user', visivel_para_usuario: false })
        .eq('id', rescheduleFromId);
    }

    // Criar agendamento (status pending, aguardando barbeiro)
    const { data: appointment, error: aptError } = await supabase
      .from('agendamentos')
      .insert({
        user_id: user.id,
        servico_id: bookingData.servico_id,
        barbeiro_id: bookingData.barbeiro_id,
        data: bookingData.data,
        hora: bookingData.hora,
        duracao: bookingData.duracao,
        preco: bookingData.preco,
        observacoes: bookingData.observacoes,
        status: 'confirmed',
        barbeiro_confirmou: true,
        cliente_confirmou: true,
        payment_method: metodo || 'cash',
        remarcado_de: rescheduleFromId || null,
      })
      .select()
      .single();

    if (aptError) throw aptError;

    if (consumeRedemptionOnPaidBooking) {
      const { error: consumeError } = await supabase.rpc('consume_available_redemptions_as_lost', {
        p_user_id: user.id,
        p_appointment_id: appointment.id,
        p_reason: 'paid_booking_without_redemption',
      });

      if (consumeError) throw consumeError;
    }

    // Google Calendar sync (non-blocking) — só dispara se o barbeiro conectou
    try {
      const { data: barberInfo } = await supabase
        .from('barbeiros')
        .select('google_calendar_connected')
        .eq('id', bookingData.barbeiro_id)
        .maybeSingle();

      if (barberInfo?.google_calendar_connected) {
        const { data: servico } = await supabase
          .from('servicos')
          .select('nome')
          .eq('id', bookingData.servico_id)
          .single();

        const startDateTime = `${bookingData.data}T${bookingData.hora}:00`;
        const endDate = new Date(`${bookingData.data}T${bookingData.hora}`);
        endDate.setMinutes(endDate.getMinutes() + bookingData.duracao);

        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/google-calendar-sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            action: 'create',
            appointmentId: appointment.id,
            summary: `Agendamento: ${servico?.nome || 'Serviço'}`,
            description: `Pagamento na barbearia (aguardando confirmação)`,
            startDateTime,
            endDateTime: endDate.toISOString().slice(0, 19),
          }),
        });
      }
    } catch (gcError) {
      console.error('[create-payment] Google Calendar error:', gcError);
    }

    // Registrar pagamento
    await supabase.from('pagamentos').insert({
      user_id: user.id,
      agendamento_id: appointment.id,
      metodo: metodo || 'cash',
      valor: bookingData.preco,
      status: metodo === 'wallet' ? 'paid' : 'pending',
    });

    return new Response(
      JSON.stringify({
        success: true,
        paymentMethod: 'cash',
        appointment,
        appointmentId: appointment.id,
        message: 'Agendamento criado! Aguardando confirmação do barbeiro.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[create-payment] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
