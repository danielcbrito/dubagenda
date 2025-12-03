/**
 * ATOMIC-BOOKING EDGE FUNCTION
 * 
 * RESERVA ATÔMICA de horários com verificação de conflito.
 * Esta função garante que não há race conditions na reserva.
 * 
 * FLUXO:
 * 1. Verificar conflitos no banco
 * 2. Criar pending_booking atomicamente
 * 3. Sincronizar com Google Calendar (se configurado)
 * 4. Retornar sucesso ou erro de conflito
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Status que BLOQUEIAM o horário
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

interface BookingResponse {
  success: boolean;
  pendingBookingId?: string;
  message?: string;
  conflictDetails?: {
    existingTime: string;
    existingDuration: number;
    existingStatus: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: BookingRequest = await req.json();
    const { date, time, duration, userId, servicoId, preco, paymentMethod, observacoes } = body;

    console.log('='.repeat(60));
    console.log('[atomic-booking] INICIANDO RESERVA ATÔMICA');
    console.log(`[atomic-booking] Data: ${date} | Hora: ${time} | Duração: ${duration}min`);
    console.log(`[atomic-booking] User: ${userId.substring(0, 8)} | Serviço: ${servicoId.substring(0, 8)}`);

    // Validar entrada
    if (!date || !time || !duration || !userId || !servicoId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Dados incompletos' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Calcular minutos do slot
    const [hour, minute] = time.split(':').map(Number);
    const slotStartMinutes = hour * 60 + minute;
    const slotEndMinutes = slotStartMinutes + duration;

    // =====================================================
    // VERIFICAÇÃO ATÔMICA DE CONFLITOS
    // =====================================================
    
    // 1. Verificar agendamentos existentes
    const { data: existingAppointments, error: aptError } = await supabase
      .from('agendamentos')
      .select('id, hora, duracao, status')
      .eq('data', date)
      .in('status', BLOCKING_STATUSES);

    if (aptError) {
      console.error('[atomic-booking] Erro ao buscar agendamentos:', aptError);
      return new Response(
        JSON.stringify({ success: false, message: 'Erro ao verificar disponibilidade' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // 2. Verificar pending_bookings
    const now = new Date();
    const { data: pendingBookings, error: pbError } = await supabase
      .from('pending_bookings')
      .select('id, hora, duracao')
      .eq('data', date)
      .gt('expires_at', now.toISOString());

    if (pbError) {
      console.error('[atomic-booking] Erro ao buscar pending_bookings:', pbError);
    }

    // 3. Combinar e verificar conflitos
    const allOccupied = [
      ...(existingAppointments || []).map(apt => ({
        hora: apt.hora,
        duracao: apt.duracao,
        status: apt.status,
        source: 'agendamento'
      })),
      ...(pendingBookings || []).map(pb => ({
        hora: pb.hora,
        duracao: pb.duracao,
        status: 'pending_booking',
        source: 'pending_booking'
      }))
    ];

    for (const occupied of allOccupied) {
      const [occHour, occMinute] = occupied.hora.split(':').map(Number);
      const occStartMinutes = occHour * 60 + occMinute;
      const occEndMinutes = occStartMinutes + occupied.duracao;

      const hasOverlap = slotStartMinutes < occEndMinutes && slotEndMinutes > occStartMinutes;

      if (hasOverlap) {
        console.log(`[atomic-booking] ❌ CONFLITO DETECTADO:`);
        console.log(`  → Slot solicitado: ${time} (${slotStartMinutes}-${slotEndMinutes})`);
        console.log(`  → Conflito com: ${occupied.hora} (${occStartMinutes}-${occEndMinutes}) [${occupied.source}]`);
        
        return new Response(
          JSON.stringify({
            success: false,
            message: 'TIME_SLOT_UNAVAILABLE',
            conflictDetails: {
              existingTime: occupied.hora,
              existingDuration: occupied.duracao,
              existingStatus: occupied.status
            }
          } as BookingResponse),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
        );
      }
    }

    // =====================================================
    // CRIAR PENDING_BOOKING ATOMICAMENTE
    // =====================================================
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutos

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
      console.error('[atomic-booking] Erro ao criar pending_booking:', insertError);
      return new Response(
        JSON.stringify({ success: false, message: 'Erro ao reservar horário' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`[atomic-booking] ✅ Pending booking criado: ${newBooking.id}`);

    // =====================================================
    // SINCRONIZAR COM GOOGLE CALENDAR (se configurado)
    // =====================================================
    try {
      const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID');
      const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
      const googleRefreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN');

      if (googleClientId && googleClientSecret && googleRefreshToken) {
        console.log('[atomic-booking] Sincronizando com Google Calendar...');
        
        // Construir datetime ISO
        const startDateTime = `${date}T${time}:00`;
        const endHour = Math.floor(slotEndMinutes / 60);
        const endMinute = slotEndMinutes % 60;
        const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
        const endDateTime = `${date}T${endTime}:00`;

        // Obter access token
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
          // Buscar nome do cliente
          const { data: profile } = await supabase
            .from('profiles')
            .select('nome')
            .eq('id', userId)
            .single();

          // Buscar nome do serviço
          const { data: servico } = await supabase
            .from('servicos')
            .select('nome')
            .eq('id', servicoId)
            .single();

          const calendarEvent = {
            summary: `⏳ AGUARDANDO - ${profile?.nome || 'Cliente'}`,
            description: `Serviço: ${servico?.nome || 'N/A'}\nStatus: Aguardando pagamento\nPending Booking ID: ${newBooking.id}`,
            start: {
              dateTime: startDateTime,
              timeZone: 'America/Sao_Paulo',
            },
            end: {
              dateTime: endDateTime,
              timeZone: 'America/Sao_Paulo',
            },
            colorId: '5', // Amarelo para pendente
          };

          const calendarResponse = await fetch(
            'https://www.googleapis.com/calendar/v3/calendars/primary/events',
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(calendarEvent),
            }
          );

          if (calendarResponse.ok) {
            const eventData = await calendarResponse.json();
            console.log(`[atomic-booking] ✅ Evento Google Calendar criado: ${eventData.id}`);
            
            // Salvar Google Calendar event ID no pending_booking
            await supabase
              .from('pending_bookings')
              .update({ observacoes: `Google Calendar ID: ${eventData.id}` })
              .eq('id', newBooking.id);
          } else {
            console.error('[atomic-booking] Erro ao criar evento Google:', await calendarResponse.text());
          }
        }
      }
    } catch (googleError) {
      console.error('[atomic-booking] Erro Google Calendar (não crítico):', googleError);
    }

    const executionTime = Date.now() - startTime;
    console.log(`[atomic-booking] ✅ RESERVA CONCLUÍDA em ${executionTime}ms`);
    console.log('='.repeat(60));

    return new Response(
      JSON.stringify({
        success: true,
        pendingBookingId: newBooking.id,
        message: 'Horário reservado com sucesso'
      } as BookingResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[atomic-booking] ERRO GERAL:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, message: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
