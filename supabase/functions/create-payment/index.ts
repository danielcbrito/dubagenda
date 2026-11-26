import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createWooviCharge } from '../_shared/woovi-charge.ts';
import { resolveBookingPixReceiver } from '../_shared/booking-payment-receiver.ts';
import { BookingPixAccountError } from '../_shared/booking-payment-route.ts';
import { assertWooviMethod } from '../_shared/woovi-payment-policy.ts';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'X-Payment-Version': 'booking-pix-mp-2026-11-26',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Valida CPF usando o algoritmo oficial
 */
function validateCPF(cpf: string): boolean {
  const cleanCPF = cpf.replace(/\D/g, '');

  if (cleanCPF.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

  let sum = 0;
  let remainder;

  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
  }

  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(9, 10))) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
  }

  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(10, 11))) return false;

  return true;
}

/**
 * Verifica disponibilidade do horário de forma atômica
 * CRÍTICO: Evita race conditions e agendamentos duplicados
 */
/**
 * Converte HH:MM para minutos totais
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Normaliza um valor de horário (HH:mm ou HH:mm:ss) para HH:mm.
 * Preserva null/undefined para não quebrar comparações que já lidam com nulos.
 */
function normalizeTimeValue(
  time: string | null | undefined
): string | null | undefined {
  if (time == null) return time;
  const [hours = "00", minutes = "00"] = String(time).split(":");
  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
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

  // 2.5) Config base da barbearia / unidade (prioridade multi-tenant sobre global legado)
  let storeConfig: any = null;
  if (tenantId) {
    const { data: unitConfig } = await supabase
      .from('configuracoes_horario_unidade')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('dia_semana', dayOfWeek)
      .order('unidade_id', { nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (unitConfig) storeConfig = unitConfig;
  }
  if (!storeConfig) {
    const { data: globalConfig } = await supabase
      .from('configuracoes_horario')
      .select('*')
      .eq('dia_semana', dayOfWeek)
      .maybeSingle();
    if (globalConfig) storeConfig = globalConfig;
  }

  // Se a barbearia estiver fechada neste dia, agendamento não é permitido
  if (storeConfig && storeConfig.aberto === false) {
    return { available: false, message: 'A barbearia não funciona neste dia.' };
  }

  if (!config && barbeiro_id) {
    // 3) Config padrão do barbeiro
    const { data: barbeiroConfig } = await supabase
      .from('configuracoes_horario_barbeiro')
      .select('*')
      .eq('barbeiro_id', barbeiro_id)
      .eq('dia_semana', dayOfWeek)
      .maybeSingle();
    if (barbeiroConfig) {
      if (barbeiroConfig.aberto === false) {
        return { available: false, message: 'O profissional não atende neste dia.' };
      }
      config = barbeiroConfig;
      configSource = 'config barbeiro';
    }
  }

  if (!config && storeConfig) {
    config = storeConfig;
    configSource = 'config unidade';
  }

  if (!config) {
    config = {
      aberto: dayOfWeek !== 0,
      hora_abertura: '09:00',
      hora_fechamento: '21:00',
      hora_almoco_inicio: '13:00',
      hora_almoco_fim: '14:00',
      delay_entre_servicos: 10
    };
    configSource = 'default fallback';
  }

  // Normaliza formatos de horário (HH:mm:ss -> HH:mm) para consistência
  // entre comparações numéricas e mensagens de erro exibidas ao cliente.
  config = {
    ...config,
    hora_abertura: normalizeTimeValue(config.hora_abertura),
    hora_fechamento: normalizeTimeValue(config.hora_fechamento),
    hora_almoco_inicio: normalizeTimeValue(config.hora_almoco_inicio),
    hora_almoco_fim: normalizeTimeValue(config.hora_almoco_fim),
  };

  // ISOLAMENTO DE EXPEDIENTE: Se a barbearia estiver fechada no dia, dia permanece fechado
  if (storeConfig && storeConfig.aberto === false) {
    config.aberto = false;
  }

  console.log(`[checkTimeSlotAvailability] Config dia ${dayOfWeek} (${configSource}${barbeiro_id ? `, barbeiro: ${barbeiro_id}` : ''}): ${config.hora_abertura}-${config.hora_fechamento}`);

  if (!config.aberto) {
    return { available: false, message: 'O profissional não atende neste dia.' };
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
    servico_ids?: string[];
    tenant_id?: string;
    barbeiro_id: string | null;
    data: string;
    hora: string;
    duracao: number;
    preco: number;
    observacoes?: string;
  };
  metodo: 'card' | 'pix' | 'cash';
  customerInfo?: {
    name: string;
    email: string;
    cpf: string;
  };
  cardInfo?: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  rescheduleFromId?: string;
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
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticating user...');
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('Authentication failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', user.id);

    const { bookingData, metodo, customerInfo, cardInfo, rescheduleFromId, consumeRedemptionOnPaidBooking }: CreatePaymentRequest = await req.json();

    assertWooviMethod(metodo);
    if (!bookingData?.barbeiro_id || !bookingData.servico_id) throw new Error('Serviço e barbeiro obrigatórios');
    const serviceIds = [...new Set(bookingData.servico_ids ?? [bookingData.servico_id])];
    if (!serviceIds.length || serviceIds.length > 20 || !serviceIds.includes(bookingData.servico_id)) throw new Error('Serviços inválidos');
    const { data: barber, error: barberError } = await supabase.from('barbeiros').select('tenant_id').eq('id', bookingData.barbeiro_id).eq('ativo', true).is('deleted_at', null).single();
    if (barberError || !barber?.tenant_id || (bookingData.tenant_id && bookingData.tenant_id !== barber.tenant_id)) throw new BookingPixAccountError('Profissional indisponível nesta barbearia.');
    const { data: services, error: servicesError } = await supabase.from('servicos').select('id,preco,duracao_minutos,tenant_id').in('id', serviceIds).eq('tenant_id', barber.tenant_id).eq('ativo', true);
    const { data: durations, error: durationError } = await supabase.from('barbeiro_servico_duracao').select('servico_id,duracao_personalizada').eq('barbeiro_id', bookingData.barbeiro_id).in('servico_id', serviceIds);
    if (barberError || servicesError || durationError || !barber || services?.length !== serviceIds.length) throw new Error('Não foi possível validar os serviços');
    if (services.some(service => service.tenant_id !== barber.tenant_id)) throw new Error('Serviço não pertence à barbearia selecionada');
    const officialPrice = services.reduce((sum, service) => sum + Math.round(Number(service.preco) * 100), 0);
    // Partial credits need atomic consumption when the callback creates the appointment.
    // Fail closed rather than sell a discounted appointment without consuming credit.
    if (Math.round(Number(bookingData.preco) * 100) !== officialPrice) {
      return new Response(JSON.stringify({ error: 'Preço divergente ou créditos parciais: esta combinação precisa ser reconciliada antes do pagamento.', code: 'PRICE_RECONCILIATION_REQUIRED' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    bookingData.preco = officialPrice / 100;
    bookingData.duracao = services.reduce((sum, service) => sum + Number(durations?.find(duration => duration.servico_id === service.id)?.duracao_personalizada ?? service.duracao_minutos), 0);
    if (rescheduleFromId) {
      const { data: owned } = await supabase.from('agendamentos').select('id').eq('id', rescheduleFromId).eq('user_id', user.id).eq('tenant_id', barber.tenant_id).maybeSingle();
      if (!owned) throw new Error('Agendamento anterior não pertence ao cliente');
    }

    // Resolve the approved provider before creating a hold; missing configuration cannot orphan a slot.
    const pixReceiver = metodo === 'pix'
      ? await resolveBookingPixReceiver(supabase, bookingData.barbeiro_id, barber.tenant_id)
      : undefined;

    console.log('Received payment request:', { bookingData, metodo, hasCustomerInfo: !!customerInfo, hasCardInfo: !!cardInfo, isRescheduling: !!rescheduleFromId });

    // ============================================
    // VERIFICAÇÃO CRÍTICA DE DISPONIBILIDADE
    // Deve acontecer ANTES de qualquer inserção
    // ============================================
    console.log('[create-payment] Verificando disponibilidade do horário...');
    const availability = await checkTimeSlotAvailability(
      supabase,
      bookingData.data,
      bookingData.hora,
      bookingData.duracao,
      rescheduleFromId, // Excluir agendamento atual se for reagendamento
      bookingData.barbeiro_id // Filtrar por barbeiro para isolamento
    );

    if (!availability.available) {
      console.log('[create-payment] Horário INDISPONÍVEL:', availability.message);
      return new Response(
        JSON.stringify({
          error: availability.message,
          code: 'TIME_SLOT_UNAVAILABLE'
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log('[create-payment] Horário DISPONÍVEL, prosseguindo...');

    // Fetch user profile for name and CPF used in payment validation
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('nome, cpf')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.warn('Profile not found for user, proceeding with limited data:', { userId: user.id, error: profileError?.message });
    }

    // Validate CPF if payment requires profile validation (PIX or Card)
    if ((metodo === 'pix' || metodo === 'card') && profile?.cpf && !validateCPF(profile.cpf)) {
      console.error('Invalid CPF in customer profile');
      return new Response(
        JSON.stringify({
          error: 'CPF inválido. Por favor, atualize seu perfil com um CPF válido antes de prosseguir com o pagamento.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle "cash" payment - create appointment immediately
    if (metodo === 'cash') {
      console.log('Creating cash appointment as confirmed (auto-confirm)');

      // If rescheduling, cancel old appointment first
      if (rescheduleFromId) {
        console.log('Cancelling previous appointment:', rescheduleFromId);
        await supabase
          .from('agendamentos')
          .update({
            status: 'cancelled_by_user',
            visivel_para_usuario: false,
          })
          .eq('id', rescheduleFromId);
      }

      // Create the appointment — AUTO-CONFIRMADO
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
          status: 'confirmed', // AUTO-CONFIRMADO: sem necessidade de aprovação manual
          barbeiro_confirmou: true, // AUTO-CONFIRMADO
          cliente_confirmou: false,
          payment_method: 'cash',
          remarcado_de: rescheduleFromId || null,
        })
        .select()
        .single();

      if (aptError) {
        console.error('Failed to create appointment:', aptError);
        throw aptError;
      }

      // ============================================
      // INTEGRAÇÃO GOOGLE CALENDAR - Criar evento
      // ============================================
      try {
        const { data: servico } = await supabase
          .from('servicos')
          .select('nome')
          .eq('id', bookingData.servico_id)
          .single();

        const startDateTime = `${bookingData.data}T${bookingData.hora}:00`;
        const endDate = new Date(`${bookingData.data}T${bookingData.hora}`);
        endDate.setMinutes(endDate.getMinutes() + bookingData.duracao);
        const endDateTime = endDate.toISOString().slice(0, 19);

        console.log('Creating Google Calendar event for cash appointment:', appointment.id);

        // Chamar edge function de sync com Google Calendar
        const googleCalendarResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-calendar-sync`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              action: 'create',
              appointmentId: appointment.id,
              summary: `Agendamento: ${servico?.nome || 'Serviço'}`,
              description: `Cliente agendou ${servico?.nome || 'serviço'} - Pagamento em DINHEIRO (aguardando confirmação)`,
              startDateTime,
              endDateTime,
            }),
          }
        );

        if (googleCalendarResponse.ok) {
          console.log('Google Calendar event created successfully');
        } else {
          console.error('Failed to create Google Calendar event:', await googleCalendarResponse.text());
        }
      } catch (gcError) {
        console.error('Error creating Google Calendar event:', gcError);
        // Não bloqueia o fluxo se Google Calendar falhar
      }

      // Create payment record
      const { data: payment, error: paymentError } = await supabase
        .from('pagamentos')
        .insert({
          user_id: user.id,
          agendamento_id: appointment.id,
          metodo: 'cash',
          valor: bookingData.preco,
          status: 'pending', // Pagamento pendente até confirmação
        })
        .select()
        .single();

      if (paymentError) {
        console.error('Failed to create payment:', paymentError);
        throw paymentError;
      }

      console.log('Cash appointment created (auto-confirmed):', appointment.id);

      // Notificação ao barbeiro
      try {
        if (bookingData.barbeiro_id) {
          const { data: barbeiro } = await supabase
            .from('barbeiros')
            .select('user_id')
            .eq('id', bookingData.barbeiro_id)
            .single();

          if (barbeiro?.user_id) {
            const { data: servico } = await supabase
              .from('servicos')
              .select('nome')
              .eq('id', bookingData.servico_id)
              .single();

            const dateParts = bookingData.data.split('-');
            const dateFormatted = `${dateParts[2]}/${dateParts[1]}`;

            await supabase.from('notificacoes').insert({
              user_id: barbeiro.user_id,
              agendamento_id: appointment.id,
              titulo: 'Novo Agendamento',
              mensagem: `${profile?.nome || 'Cliente'} agendou ${servico?.nome || 'serviço'} para ${dateFormatted} às ${bookingData.hora.substring(0, 5)} — Pagamento na barbearia.`,
              tipo: 'geral',
              lida: false,
            });
          }
        }
      } catch (notifError) {
        console.error('Error sending barber notification:', notifError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          paymentMethod: 'cash',
          appointment,
          payment,
          appointmentId: appointment.id,
          message: 'Agendamento confirmado!',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For PIX and Card, create pending booking first
    console.log('Creating pending booking for PIX/Card payment');

    const { data: pendingBooking, error: pendingError } = await supabase
      .from('pending_bookings')
      .insert({
        user_id: user.id,
        servico_id: bookingData.servico_id,
        barbeiro_id: bookingData.barbeiro_id,
        data: bookingData.data,
        hora: bookingData.hora,
        duracao: bookingData.duracao,
        preco: bookingData.preco,
        observacoes: bookingData.observacoes,
        payment_method: metodo,
      })
      .select()
      .single();

    if (pendingError) {
      console.error('Failed to create pending booking:', pendingError);
      throw pendingError;
    }

    console.log('Pending booking created:', pendingBooking.id);

    if (!bookingData.barbeiro_id) throw new Error('Barbeiro obrigatório');
    const wooviPayment = await createWooviCharge(supabase, {
      correlationID: `book-${pendingBooking.id}`, userId: user.id,
      barberId: bookingData.barbeiro_id, tenantId: barber.tenant_id, receiver: pixReceiver, amount: pendingBooking.preco,
      comment: `Reserva ${pendingBooking.id.slice(0, 8)}`,
      target: { pending_booking_id: pendingBooking.id, metadata: { reschedule_from_id: rescheduleFromId ?? null, consume_redemption_on_paid_booking: !!consumeRedemptionOnPaidBooking } },
    });
    const { error: saveError } = await supabase.from('pending_bookings').update({
      payment_intent_id: wooviPayment.id,
      pix_qr_code: wooviPayment.pixQrCode.encodedImage,
      pix_payload: wooviPayment.pixQrCode.payload,
    }).eq('id', pendingBooking.id);
    if (saveError) throw saveError;
    return new Response(JSON.stringify({ success: true, paymentMethod: 'pix',
      pendingBookingId: pendingBooking.id, pendingBooking, wooviPayment,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('Error processing payment:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Erro ao processar pagamento',
        ...(error instanceof BookingPixAccountError ? { code: error.code } : {})
      }),
      { status: error instanceof BookingPixAccountError ? 409 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
