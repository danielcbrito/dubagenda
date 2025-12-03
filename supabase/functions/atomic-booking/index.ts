/**
 * ATOMIC-BOOKING EDGE FUNCTION
 * 
 * RESERVA ATÔMICA de horários com verificação de conflito.
 * Inclui delay obrigatório entre atendimentos.
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
    const { date, time, duration, userId, servicoId, preco, paymentMethod, observacoes } = body;

    console.log('='.repeat(60));
    console.log(`[atomic-booking] Data: ${date} | Hora: ${time} | Duração: ${duration}min`);

    if (!date || !time || !duration || !userId || !servicoId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Dados incompletos' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Buscar configurações do dia
    const dateObj = new Date(date + 'T12:00:00');
    const dayOfWeek = dateObj.getDay();

    const { data: configData } = await supabase
      .from('configuracoes_horario')
      .select('delay_entre_servicos')
      .eq('dia_semana', dayOfWeek)
      .single();

    const DELAY_MINUTES = configData?.delay_entre_servicos || 10;

    const [hour, minute] = time.split(':').map(Number);
    const slotStartMinutes = hour * 60 + minute;
    const slotEndMinutes = slotStartMinutes + duration;
    const slotEndWithDelay = slotEndMinutes + DELAY_MINUTES;

    // Verificar agendamentos existentes
    const { data: existingAppointments } = await supabase
      .from('agendamentos')
      .select('id, hora, duracao, status')
      .eq('data', date)
      .in('status', BLOCKING_STATUSES);

    // Verificar pending_bookings
    const now = new Date();
    const { data: pendingBookings } = await supabase
      .from('pending_bookings')
      .select('id, hora, duracao')
      .eq('data', date)
      .gt('expires_at', now.toISOString());

    // Verificar conflitos (incluindo delay)
    const allOccupied = [
      ...(existingAppointments || []).map(apt => ({
        hora: apt.hora,
        duracao: apt.duracao,
        duracaoComDelay: apt.duracao + DELAY_MINUTES,
        status: apt.status
      })),
      ...(pendingBookings || []).map(pb => ({
        hora: pb.hora,
        duracao: pb.duracao,
        duracaoComDelay: pb.duracao + DELAY_MINUTES,
        status: 'pending_booking'
      }))
    ];

    for (const occupied of allOccupied) {
      const [occHour, occMinute] = occupied.hora.split(':').map(Number);
      const occStartMinutes = occHour * 60 + occMinute;
      const occEndMinutes = occStartMinutes + occupied.duracaoComDelay;

      const hasOverlap = slotStartMinutes < occEndMinutes && slotEndWithDelay > occStartMinutes;

      if (hasOverlap) {
        console.log(`[atomic-booking] ❌ CONFLITO: ${time} vs ${occupied.hora}`);
        return new Response(
          JSON.stringify({
            success: false,
            message: 'TIME_SLOT_UNAVAILABLE',
            conflictDetails: { existingTime: occupied.hora, existingDuration: occupied.duracao, existingStatus: occupied.status }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
        );
      }
    }

    // Criar pending_booking
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);

    const { data: newBooking, error: insertError } = await supabase
      .from('pending_bookings')
      .insert({
        data: date,
        hora: time,
        duracao: duration,
        user_id: userId,
        servico_id: servicoId,
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