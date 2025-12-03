/**
 * CHECK-AVAILABILITY EDGE FUNCTION
 * 
 * FONTE ÚNICA DA VERDADE para disponibilidade de horários.
 * Esta função é a ÚNICA que deve ser consultada para verificar disponibilidade.
 * 
 * REGRAS DE BLOQUEIO:
 * - pending, confirmed, completed → BLOQUEIA
 * - cancelled_by_user, cancelled_by_admin, no_show, excluido → LIBERA
 * - pending_bookings não expirados → BLOQUEIA
 * 
 * HORÁRIO DE FUNCIONAMENTO:
 * - Segunda a Sábado: 09:00 às 20:00
 * - Almoço: 13:00 às 14:00 (fechado)
 * - Domingo: fechado
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Status que BLOQUEIAM o horário
const BLOCKING_STATUSES = ['pending', 'confirmed', 'completed'];

// Horários de funcionamento
const BUSINESS_HOURS = {
  OPEN: 9,      // 09:00
  CLOSE: 20,    // 20:00
  LUNCH_START: 13 * 60, // 13:00 em minutos
  LUNCH_END: 14 * 60,   // 14:00 em minutos
};

interface AvailabilityRequest {
  date: string;           // YYYY-MM-DD
  duration: number;       // minutos
  excludeAppointmentId?: string; // para reagendamento
}

interface TimeSlot {
  time: string;
  available: boolean;
  blockedReason?: 'occupied' | 'minimum_advance' | 'lunch' | 'closed' | 'overlap';
}

interface AvailabilityResponse {
  success: boolean;
  date: string;
  slots: TimeSlot[];
  occupiedSlots: Array<{
    hora: string;
    duracao: number;
    status: string;
    source: 'agendamento' | 'pending_booking';
  }>;
  message?: string;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: AvailabilityRequest = await req.json();
    const { date, duration, excludeAppointmentId } = body;

    console.log('='.repeat(60));
    console.log('[check-availability] INICIANDO VERIFICAÇÃO');
    console.log(`[check-availability] Data: ${date} | Duração: ${duration}min`);
    console.log(`[check-availability] Excluir ID: ${excludeAppointmentId || 'N/A'}`);

    // Validar entrada
    if (!date || !duration) {
      return new Response(
        JSON.stringify({ success: false, message: 'Data e duração são obrigatórios' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Verificar se é domingo
    const dateObj = new Date(date + 'T12:00:00');
    if (dateObj.getDay() === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          date, 
          slots: [], 
          occupiedSlots: [],
          message: 'Fechado aos domingos' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // =====================================================
    // CONSULTA 1: Agendamentos existentes (FONTE DA VERDADE)
    // =====================================================
    let appointmentsQuery = supabase
      .from('agendamentos')
      .select('id, hora, duracao, status')
      .eq('data', date)
      .in('status', BLOCKING_STATUSES);

    if (excludeAppointmentId) {
      appointmentsQuery = appointmentsQuery.neq('id', excludeAppointmentId);
    }

    const { data: appointments, error: aptError } = await appointmentsQuery;

    if (aptError) {
      console.error('[check-availability] ERRO ao buscar agendamentos:', aptError);
      return new Response(
        JSON.stringify({ success: false, message: 'Erro ao verificar disponibilidade' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`[check-availability] Agendamentos encontrados: ${appointments?.length || 0}`);
    appointments?.forEach(apt => {
      console.log(`  → ${apt.hora} | ${apt.duracao}min | ${apt.status} | ID: ${apt.id.substring(0, 8)}`);
    });

    // =====================================================
    // CONSULTA 2: Reservas pendentes (aguardando pagamento)
    // =====================================================
    const now = new Date();
    const { data: pendingBookings, error: pendingError } = await supabase
      .from('pending_bookings')
      .select('id, hora, duracao, expires_at')
      .eq('data', date)
      .gt('expires_at', now.toISOString());

    if (pendingError) {
      console.error('[check-availability] ERRO ao buscar pending_bookings:', pendingError);
    }

    console.log(`[check-availability] Pending bookings: ${pendingBookings?.length || 0}`);
    pendingBookings?.forEach(pb => {
      console.log(`  → ${pb.hora} | ${pb.duracao}min | Expira: ${pb.expires_at}`);
    });

    // =====================================================
    // COMBINAR TODOS OS SLOTS OCUPADOS
    // =====================================================
    const occupiedSlots = [
      ...(appointments || []).map(apt => ({
        hora: apt.hora,
        duracao: apt.duracao,
        status: apt.status,
        source: 'agendamento' as const
      })),
      ...(pendingBookings || []).map(pb => ({
        hora: pb.hora,
        duracao: pb.duracao,
        status: 'pending_booking',
        source: 'pending_booking' as const
      }))
    ];

    // =====================================================
    // CALCULAR HORÁRIO MÍNIMO (antecedência de 1 hora para hoje)
    // =====================================================
    const todayStr = now.toISOString().split('T')[0];
    const isToday = date === todayStr;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const minimumAdvanceMinutes = isToday ? currentMinutes + 60 : 0;

    console.log(`[check-availability] É hoje: ${isToday} | Mínimo: ${minimumAdvanceMinutes}min`);

    // =====================================================
    // GERAR SLOTS DE HORÁRIO (09:00 - 20:00)
    // =====================================================
    const slots: TimeSlot[] = [];

    for (let hour = BUSINESS_HOURS.OPEN; hour < BUSINESS_HOURS.CLOSE; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const slotStartMinutes = hour * 60 + minute;
        const slotEndMinutes = slotStartMinutes + duration;

        // REGRA 1: Não pode ultrapassar horário de fechamento
        if (slotEndMinutes > BUSINESS_HOURS.CLOSE * 60) {
          continue;
        }

        // REGRA 2: Não pode estar no horário de almoço
        const overlapsLunch = (
          (slotStartMinutes >= BUSINESS_HOURS.LUNCH_START && slotStartMinutes < BUSINESS_HOURS.LUNCH_END) ||
          (slotEndMinutes > BUSINESS_HOURS.LUNCH_START && slotEndMinutes <= BUSINESS_HOURS.LUNCH_END) ||
          (slotStartMinutes < BUSINESS_HOURS.LUNCH_START && slotEndMinutes > BUSINESS_HOURS.LUNCH_END)
        );

        if (overlapsLunch) {
          continue;
        }

        // REGRA 3: Antecedência mínima de 1 hora para mesmo dia
        if (isToday && slotStartMinutes < minimumAdvanceMinutes) {
          slots.push({
            time: timeStr,
            available: false,
            blockedReason: 'minimum_advance'
          });
          continue;
        }

        // REGRA 4: Verificar conflito com agendamentos existentes
        let isOccupied = false;
        let conflictInfo = '';

        for (const occupied of occupiedSlots) {
          const [occHour, occMinute] = occupied.hora.split(':').map(Number);
          const occStartMinutes = occHour * 60 + occMinute;
          const occEndMinutes = occStartMinutes + occupied.duracao;

          // FÓRMULA DE SOBREPOSIÇÃO:
          // Dois intervalos [A, B) e [C, D) se sobrepõem quando: A < D E B > C
          const hasOverlap = slotStartMinutes < occEndMinutes && slotEndMinutes > occStartMinutes;

          if (hasOverlap) {
            isOccupied = true;
            conflictInfo = `${occupied.source} às ${occupied.hora} (${occStartMinutes}-${occEndMinutes})`;
            break;
          }
        }

        if (isOccupied) {
          console.log(`[check-availability] ❌ BLOQUEADO ${timeStr} (${slotStartMinutes}-${slotEndMinutes}) → Conflito: ${conflictInfo}`);
        }

        slots.push({
          time: timeStr,
          available: !isOccupied,
          blockedReason: isOccupied ? 'occupied' : undefined
        });
      }
    }

    // =====================================================
    // RESULTADO FINAL
    // =====================================================
    const availableCount = slots.filter(s => s.available).length;
    const blockedCount = slots.filter(s => !s.available).length;
    const executionTime = Date.now() - startTime;

    console.log(`[check-availability] RESULTADO FINAL:`);
    console.log(`  → Total de slots: ${slots.length}`);
    console.log(`  → Disponíveis: ${availableCount}`);
    console.log(`  → Bloqueados: ${blockedCount}`);
    console.log(`  → Tempo de execução: ${executionTime}ms`);
    console.log('='.repeat(60));

    const response: AvailabilityResponse = {
      success: true,
      date,
      slots,
      occupiedSlots
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[check-availability] ERRO GERAL:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, message: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
