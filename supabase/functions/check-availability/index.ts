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
 * - Configurável por dia da semana via tabela configuracoes_horario
 * - Delay obrigatório entre atendimentos (padrão: 10 minutos)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Status que BLOQUEIAM o horário
const BLOCKING_STATUSES = ['pending', 'confirmed', 'completed'];

interface BusinessHoursConfig {
  aberto: boolean;
  hora_abertura: string;
  hora_fechamento: string;
  hora_almoco_inicio: string | null;
  hora_almoco_fim: string | null;
  delay_entre_servicos: number;
}

interface AvailabilityRequest {
  date: string;
  duration: number;
  excludeAppointmentId?: string;
}

interface TimeSlot {
  time: string;
  available: boolean;
  blockedReason?: 'occupied' | 'minimum_advance' | 'lunch' | 'closed' | 'overlap' | 'delay_buffer';
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
  businessHours?: BusinessHoursConfig;
  message?: string;
}

function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
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

    const body: AvailabilityRequest = await req.json();
    const { date, duration, excludeAppointmentId } = body;

    console.log('='.repeat(60));
    console.log('[check-availability] INICIANDO VERIFICAÇÃO');
    console.log(`[check-availability] Data: ${date} | Duração: ${duration}min`);

    if (!date || !duration) {
      return new Response(
        JSON.stringify({ success: false, message: 'Data e duração são obrigatórios' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const dateObj = new Date(date + 'T12:00:00');
    const dayOfWeek = dateObj.getDay();

    // Buscar configurações do dia
    const { data: configData, error: configError } = await supabase
      .from('configuracoes_horario')
      .select('*')
      .eq('dia_semana', dayOfWeek)
      .single();

    if (configError) {
      console.log('[check-availability] Usando configuração padrão');
    }

    const config: BusinessHoursConfig = configData || {
      aberto: dayOfWeek !== 0,
      hora_abertura: '09:00',
      hora_fechamento: dayOfWeek >= 3 && dayOfWeek <= 6 ? '21:00' : '20:00',
      hora_almoco_inicio: '13:00',
      hora_almoco_fim: '14:00',
      delay_entre_servicos: 10
    };

    console.log(`[check-availability] Config: ${JSON.stringify(config)}`);

    if (!config.aberto) {
      return new Response(
        JSON.stringify({ 
          success: true, date, slots: [], occupiedSlots: [],
          businessHours: config, message: 'Fechado neste dia' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const OPEN_MINUTES = timeToMinutes(config.hora_abertura);
    const CLOSE_MINUTES = timeToMinutes(config.hora_fechamento);
    const LUNCH_START = config.hora_almoco_inicio ? timeToMinutes(config.hora_almoco_inicio) : null;
    const LUNCH_END = config.hora_almoco_fim ? timeToMinutes(config.hora_almoco_fim) : null;
    const DELAY_MINUTES = config.delay_entre_servicos;

    console.log(`[check-availability] Horário: ${config.hora_abertura}-${config.hora_fechamento} | Delay: ${DELAY_MINUTES}min`);

    // Buscar agendamentos
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
      console.error('[check-availability] ERRO:', aptError);
      return new Response(
        JSON.stringify({ success: false, message: 'Erro ao verificar disponibilidade' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Buscar pending bookings
    const now = new Date();
    const { data: pendingBookings } = await supabase
      .from('pending_bookings')
      .select('id, hora, duracao, expires_at')
      .eq('data', date)
      .gt('expires_at', now.toISOString());

    console.log(`[check-availability] Agendamentos: ${appointments?.length || 0} | Pending: ${pendingBookings?.length || 0}`);

    // Combinar slots ocupados (duração real SEM delay duplicado)
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

    // Calcular horário mínimo (1h de antecedência para hoje)
    const todayStr = now.toISOString().split('T')[0];
    const isToday = date === todayStr;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const minimumAdvanceMinutes = isToday ? currentMinutes + 60 : 0;

    // Gerar slots a cada 10 minutos (para respeitar delay corretamente)
    const slots: TimeSlot[] = [];
    const SLOT_INTERVAL = 10; // Intervalo de 10 minutos entre slots

    for (let slotStartMinutes = OPEN_MINUTES; slotStartMinutes < CLOSE_MINUTES; slotStartMinutes += SLOT_INTERVAL) {
      const hour = Math.floor(slotStartMinutes / 60);
      const minute = slotStartMinutes % 60;
      const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      const slotEndMinutes = slotStartMinutes + duration;

      // Verificar se cabe antes do fechamento (apenas o serviço, delay não precisa caber)
      if (slotEndMinutes > CLOSE_MINUTES) continue;

      // Verificar almoço - slot não pode começar nem terminar durante o almoço
      if (LUNCH_START !== null && LUNCH_END !== null) {
        const overlapsLunch = (
          (slotStartMinutes >= LUNCH_START && slotStartMinutes < LUNCH_END) ||
          (slotEndMinutes > LUNCH_START && slotEndMinutes <= LUNCH_END) ||
          (slotStartMinutes < LUNCH_START && slotEndMinutes > LUNCH_END)
        );
        if (overlapsLunch) continue;
      }

      // Verificar antecedência mínima (1h para hoje)
      if (isToday && slotStartMinutes < minimumAdvanceMinutes) {
        slots.push({ time: timeStr, available: false, blockedReason: 'minimum_advance' });
        continue;
      }

      // REGRA CORRETA DE BLOQUEIO:
      // Um slot novo pode começar APÓS o término do agendamento existente + delay
      // Exemplo: agendamento 09:00 com 30min = termina 09:30 + 10min delay = próximo pode começar 09:40
      let isOccupied = false;
      let blockingReason = '';
      
      for (const occupied of occupiedSlots) {
        const [occHour, occMinute] = occupied.hora.split(':').map(Number);
        const occStartMinutes = occHour * 60 + occMinute;
        const occEndMinutes = occStartMinutes + occupied.duracao;
        const occEndWithDelay = occEndMinutes + DELAY_MINUTES;

        // REGRA: Novo slot NÃO pode começar se:
        // 1. Começa durante o agendamento existente (slotStart < occEnd)
        // 2. OU começa durante o delay do agendamento existente (slotStart < occEndWithDelay)
        // 3. E o novo slot terminaria após o início do existente (slotEnd > occStart)
        
        // Simplificando: slot novo só pode começar a partir de occEndWithDelay
        // E não pode terminar após o início de um agendamento
        
        const conflictsWithExisting = (
          // Novo slot começa antes do fim do existente + delay
          (slotStartMinutes < occEndWithDelay && slotEndMinutes > occStartMinutes)
        );

        if (conflictsWithExisting) {
          isOccupied = true;
          blockingReason = `${occupied.hora} (${occupied.duracao}min termina ${Math.floor(occEndMinutes/60)}:${(occEndMinutes%60).toString().padStart(2,'0')} + ${DELAY_MINUTES}min delay = livre ${Math.floor(occEndWithDelay/60)}:${(occEndWithDelay%60).toString().padStart(2,'0')})`;
          break;
        }
      }

      if (isOccupied) {
        console.log(`[check-availability] ❌ ${timeStr} bloqueado por ${blockingReason}`);
      }

      slots.push({
        time: timeStr,
        available: !isOccupied,
        blockedReason: isOccupied ? 'occupied' : undefined
      });
    }

    const availableCount = slots.filter(s => s.available).length;
    console.log(`[check-availability] Total: ${slots.length} | Disponíveis: ${availableCount}`);
    console.log('='.repeat(60));

    return new Response(
      JSON.stringify({
        success: true,
        date,
        slots,
        occupiedSlots: occupiedSlots.map(o => ({
          hora: o.hora,
          duracao: o.duracao,
          status: o.status,
          source: o.source
        })),
        businessHours: config
      } as AvailabilityResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[check-availability] ERRO GERAL:', error);
    return new Response(
      JSON.stringify({ success: false, message: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});