/**
 * ATOMIC-BOOKING EDGE FUNCTION
 * 
 * RESERVA ATÔMICA de horários com verificação de conflito.
 * Inclui delay obrigatório entre atendimentos.
 * ISOLAMENTO POR BARBEIRO: filtra agendamentos e pending_bookings pelo barbeiro selecionado.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BLOCKING_STATUSES = ['pending', 'confirmed', 'completed'];

interface BookingRequest {
  date: string;
  time: string;
  duration: number;
  userId: string;
  servicoId: string;
  preco: number;
  paymentMethod?: string;
  observacoes?: string;
  barbeiroId?: string; // CRÍTICO: isolamento por barbeiro
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: BookingRequest = await req.json();
    const { date, time, duration, userId, servicoId, preco, paymentMethod, observacoes, barbeiroId } = body;

    console.log('='.repeat(60));
    console.log(`[atomic-booking] Data: ${date} | Hora: ${time} | Duração: ${duration}min | Barbeiro: ${barbeiroId || 'N/A'}`);

    if (!date || !time || !duration || !userId || !servicoId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Dados incompletos' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Buscar configurações do dia (prioridade: barbeiro > global)
    const dateObj = new Date(date + 'T12:00:00');
    const dayOfWeek = dateObj.getDay();

    let delayMinutes = 10;

    if (barbeiroId) {
      const { data: barberConfig } = await supabase
        .from('configuracoes_horario_barbeiro')
        .select('delay_entre_servicos')
        .eq('barbeiro_id', barbeiroId)
        .eq('dia_semana', dayOfWeek)
        .maybeSingle();
      if (barberConfig?.delay_entre_servicos) {
        delayMinutes = barberConfig.delay_entre_servicos;
      }
    }

    if (delayMinutes === 10) {
      const { data: configData } = await supabase
        .from('configuracoes_horario')
        .select('delay_entre_servicos')
        .eq('dia_semana', dayOfWeek)
        .single();
      delayMinutes = configData?.delay_entre_servicos || 10;
    }

    const DELAY_MINUTES = delayMinutes;

    const [hour, minute] = time.split(':').map(Number);
    const slotStartMinutes = hour * 60 + minute;
    const slotEndMinutes = slotStartMinutes + duration;

    // Verificar agendamentos existentes (FILTRADO POR BARBEIRO)
    let aptQuery = supabase
      .from('agendamentos')
      .select('id, hora, duracao, status')
      .eq('data', date)
      .in('status', BLOCKING_STATUSES);
    if (barbeiroId) aptQuery = aptQuery.eq('barbeiro_id', barbeiroId);

    const { data: existingAppointments } = await aptQuery;

    // Verificar pending_bookings (FILTRADO POR BARBEIRO)
    const now = new Date();
    let pbQuery = supabase
      .from('pending_bookings')
      .select('id, hora, duracao')
      .eq('data', date)
      .gt('expires_at', now.toISOString());
    if (barbeiroId) pbQuery = pbQuery.eq('barbeiro_id', barbeiroId);

    const { data: pendingBookings } = await pbQuery;

    // Verificar conflitos
    const allOccupied = [
      ...(existingAppointments || []).map(apt => ({
        hora: apt.hora, duracao: apt.duracao, status: apt.status
      })),
      ...(pendingBookings || []).map(pb => ({
        hora: pb.hora, duracao: pb.duracao, status: 'pending_booking'
      }))
    ];

    for (const occupied of allOccupied) {
      const [occHour, occMinute] = occupied.hora.split(':').map(Number);
      const occStartMinutes = occHour * 60 + occMinute;
      const occEndMinutes = occStartMinutes + occupied.duracao;
      const occEndWithDelay = occEndMinutes + DELAY_MINUTES;

      const hasOverlap = slotStartMinutes < occEndWithDelay && slotEndMinutes > occStartMinutes;

      if (hasOverlap) {
        const nextFreeMinutes = occEndWithDelay;
        const nextFreeTime = `${Math.floor(nextFreeMinutes / 60).toString().padStart(2, '0')}:${(nextFreeMinutes % 60).toString().padStart(2, '0')}`;
        
        console.log(`[atomic-booking] ❌ CONFLITO: ${time} vs ${occupied.hora} (próximo livre: ${nextFreeTime})`);
        return new Response(
          JSON.stringify({
            success: false,
            message: 'TIME_SLOT_UNAVAILABLE',
            conflictDetails: { 
              existingTime: occupied.hora, 
              existingDuration: occupied.duracao, 
              existingStatus: occupied.status,
              nextAvailable: nextFreeTime
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
        );
      }
    }

    // Criar pending_booking (COM barbeiro_id para isolamento)
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);

    const { data: newBooking, error: insertError } = await supabase
      .from('pending_bookings')
      .insert({
        data: date,
        hora: time,
        duracao: duration,
        user_id: userId,
        servico_id: servicoId,
        barbeiro_id: barbeiroId || null,
        preco: preco,
        payment_method: paymentMethod || 'pix',
        observacoes: observacoes || null,
        expires_at: expiresAt.toISOString()
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[atomic-booking] Erro:', insertError);
      return new Response(
        JSON.stringify({ success: false, message: 'Erro ao reservar horário' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`[atomic-booking] ✅ Booking criado: ${newBooking.id}`);

    // Sincronizar com Google Calendar
    try {
      const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID');
      const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
      const googleRefreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN');

      if (googleClientId && googleClientSecret && googleRefreshToken) {
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: googleClientId,
            client_secret: googleClientSecret,
            refresh_token: googleRefreshToken,
            grant_type: 'refresh_token',
          }),
        });

        const { access_token } = await tokenResponse.json();

        if (access_token) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('nome')
            .eq('id', userId)
            .single();

          const { data: servico } = await supabase
            .from('servicos')
            .select('nome')
            .eq('id', servicoId)
            .single();

          const endHour = Math.floor(slotEndMinutes / 60);
          const endMinute = slotEndMinutes % 60;
          const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

          const calendarEvent = {
            summary: `⏳ AGUARDANDO - ${profile?.nome || 'Cliente'}`,
            description: `Serviço: ${servico?.nome || 'N/A'}\nPending ID: ${newBooking.id}`,
            start: { dateTime: `${date}T${time}:00`, timeZone: 'America/Sao_Paulo' },
            end: { dateTime: `${date}T${endTime}:00`, timeZone: 'America/Sao_Paulo' },
            colorId: '5',
          };

          const calendarResponse = await fetch(
            'https://www.googleapis.com/calendar/v3/calendars/primary/events',
            {
              method: 'POST',
              headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(calendarEvent),
            }
          );

          if (calendarResponse.ok) {
            const eventData = await calendarResponse.json();
            console.log(`[atomic-booking] ✅ Google Calendar: ${eventData.id}`);
            await supabase
              .from('pending_bookings')
              .update({ observacoes: `Google Calendar ID: ${eventData.id}` })
              .eq('id', newBooking.id);
          }
        }
      }
    } catch (googleError) {
      console.error('[atomic-booking] Google Calendar erro:', googleError);
    }

    console.log('='.repeat(60));

    return new Response(
      JSON.stringify({ success: true, pendingBookingId: newBooking.id, message: 'Horário reservado' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[atomic-booking] ERRO:', error);
    return new Response(
      JSON.stringify({ success: false, message: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
