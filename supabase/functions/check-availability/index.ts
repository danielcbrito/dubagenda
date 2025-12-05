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
 * REGRA DE DISPONIBILIDADE:
 * próximo_horário_disponível = horário_fim_do_serviço + delay (10min)
 * 
 * Exemplo: Serviço 18:30 (30min) → termina 19:00 + 10min delay = próximo às 19:10
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

interface OccupiedSlotInfo {
  hora: string;
  duracao: number;
  status: string;
  source: 'agendamento' | 'pending_booking';
  fim: string; // hora de término
  fimComDelay: string; // hora de término + delay
}

interface AvailabilityResponse {
  success: boolean;
  date: string;
  slots: TimeSlot[];
  occupiedSlots: OccupiedSlotInfo[];
  businessHours?: BusinessHoursConfig;
  message?: string;
}

function timeToMinutes(timeStr: string): number {
  // Handle both "HH:MM" and "HH:MM:SS" formats
  const parts = timeStr.split(':').map(Number);
  return parts[0] * 60 + parts[1];
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: AvailabilityRequest = await req.json();
    const { date, duration, excludeAppointmentId } = body;

    console.log('='.repeat(70));
    console.log('[check-availability] INICIANDO VERIFICAÇÃO');
    console.log(`[check-availability] Data: ${date} | Duração solicitada: ${duration}min`);

    if (!date || !duration || duration <= 0) {
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
      .maybeSingle();

    if (configError) {
      console.log('[check-availability] Erro ao buscar config:', configError.message);
    }

    // Se não encontrou config no banco, retornar erro para forçar configuração
    if (!configData) {
      console.warn(`[check-availability] ATENÇÃO: Nenhuma configuração encontrada para dia ${dayOfWeek}. Usando padrão de emergência.`);
    }

    // NUNCA usar valores hardcoded - sempre preferir dados do banco
    const config: BusinessHoursConfig = configData ? {
      aberto: configData.aberto,
      hora_abertura: configData.hora_abertura,
      hora_fechamento: configData.hora_fechamento,
      hora_almoco_inicio: configData.hora_almoco_inicio,
      hora_almoco_fim: configData.hora_almoco_fim,
      delay_entre_servicos: configData.delay_entre_servicos || 10
    } : {
      // Fallback apenas se não houver dados no banco (emergência)
      aberto: dayOfWeek !== 0, // Fechado domingo
      hora_abertura: '09:00',
      hora_fechamento: '21:00', // Padrão estendido para evitar bloqueios
      hora_almoco_inicio: '13:00',
      hora_almoco_fim: '14:00',
      delay_entre_servicos: 10
    };

    console.log(`[check-availability] Config do dia ${dayOfWeek}:`, JSON.stringify(config));
    console.log(`[check-availability] Horário: ${config.hora_abertura} - ${config.hora_fechamento}`);

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
    const DELAY_MINUTES = config.delay_entre_servicos || 10;

    console.log(`[check-availability] Horário: ${minutesToTime(OPEN_MINUTES)}-${minutesToTime(CLOSE_MINUTES)} | Almoço: ${LUNCH_START ? minutesToTime(LUNCH_START) : 'N/A'}-${LUNCH_END ? minutesToTime(LUNCH_END) : 'N/A'} | Delay: ${DELAY_MINUTES}min`);

    // Buscar agendamentos com status bloqueante
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

    // Buscar pending bookings não expirados
    const now = new Date();
    const { data: pendingBookings, error: pbError } = await supabase
      .from('pending_bookings')
      .select('id, hora, duracao, expires_at')
      .eq('data', date)
      .gt('expires_at', now.toISOString());

    if (pbError) {
      console.log('[check-availability] Aviso ao buscar pending:', pbError.message);
    }

    console.log(`[check-availability] Agendamentos encontrados: ${appointments?.length || 0}`);
    console.log(`[check-availability] Pending bookings encontrados: ${pendingBookings?.length || 0}`);

    // Processar todos os slots ocupados com cálculo correto de fim + delay
    const occupiedSlots: OccupiedSlotInfo[] = [];

    for (const apt of appointments || []) {
      const startMinutes = timeToMinutes(apt.hora);
      const endMinutes = startMinutes + apt.duracao;
      const endWithDelayMinutes = endMinutes + DELAY_MINUTES;

      const info: OccupiedSlotInfo = {
        hora: apt.hora,
        duracao: apt.duracao,
        status: apt.status,
        source: 'agendamento',
        fim: minutesToTime(endMinutes),
        fimComDelay: minutesToTime(endWithDelayMinutes)
      };
      occupiedSlots.push(info);
      console.log(`[check-availability] → Agendamento: ${apt.hora} (${apt.duracao}min) | Fim: ${info.fim} | Livre após: ${info.fimComDelay}`);
    }

    for (const pb of pendingBookings || []) {
      const startMinutes = timeToMinutes(pb.hora);
      const endMinutes = startMinutes + pb.duracao;
      const endWithDelayMinutes = endMinutes + DELAY_MINUTES;

      const info: OccupiedSlotInfo = {
        hora: pb.hora,
        duracao: pb.duracao,
        status: 'pending_booking',
        source: 'pending_booking',
        fim: minutesToTime(endMinutes),
        fimComDelay: minutesToTime(endWithDelayMinutes)
      };
      occupiedSlots.push(info);
      console.log(`[check-availability] → Pending: ${pb.hora} (${pb.duracao}min) | Fim: ${info.fim} | Livre após: ${info.fimComDelay}`);
    }

    // Calcular horário mínimo (1h de antecedência para hoje)
    const todayStr = now.toISOString().split('T')[0];
    const isToday = date === todayStr;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const minimumAdvanceMinutes = isToday ? currentMinutes + 60 : 0;

    if (isToday) {
      console.log(`[check-availability] É HOJE - Hora atual: ${minutesToTime(currentMinutes)} | Mínimo: ${minutesToTime(minimumAdvanceMinutes)}`);
    }

    // Gerar slots a cada 10 minutos
    const slots: TimeSlot[] = [];
    const SLOT_INTERVAL = 10;

    for (let slotStartMinutes = OPEN_MINUTES; slotStartMinutes < CLOSE_MINUTES; slotStartMinutes += SLOT_INTERVAL) {
      const timeStr = minutesToTime(slotStartMinutes);
      const slotEndMinutes = slotStartMinutes + duration;

      // 1. Verificar se o serviço cabe antes do fechamento
      if (slotEndMinutes > CLOSE_MINUTES) {
        continue; // Slot ignorado - não cabe
      }

      // 2. Verificar almoço - slot não pode começar durante o almoço nem o serviço terminar durante
      if (LUNCH_START !== null && LUNCH_END !== null) {
        // Slot começa durante almoço?
        if (slotStartMinutes >= LUNCH_START && slotStartMinutes < LUNCH_END) {
          continue;
        }
        // Serviço terminaria durante o almoço?
        if (slotEndMinutes > LUNCH_START && slotEndMinutes <= LUNCH_END) {
          continue;
        }
        // Serviço atravessa todo o almoço?
        if (slotStartMinutes < LUNCH_START && slotEndMinutes > LUNCH_END) {
          continue;
        }
      }

      // 3. Verificar antecedência mínima (1h para hoje)
      if (isToday && slotStartMinutes < minimumAdvanceMinutes) {
        slots.push({ time: timeStr, available: false, blockedReason: 'minimum_advance' });
        continue;
      }

      // 4. Verificar conflitos com slots ocupados
      // REGRA: Um novo slot pode ser agendado se:
      //   - slotStart >= fimComDelay de TODOS os agendamentos existentes que começam ANTES do slotEnd
      //   - slotEnd <= início de QUALQUER agendamento existente
      let isBlocked = false;
      let blockReason = '';

      for (const occupied of occupiedSlots) {
        const occStartMinutes = timeToMinutes(occupied.hora);
        const occEndMinutes = occStartMinutes + occupied.duracao;
        const occEndWithDelayMinutes = occEndMinutes + DELAY_MINUTES;

        // Verificar sobreposição considerando delay
        // Conflito existe se:
        // - O novo slot começa ANTES do fim do existente + delay
        // - E o novo slot termina DEPOIS do início do existente
        const hasConflict = (slotStartMinutes < occEndWithDelayMinutes) && (slotEndMinutes > occStartMinutes);

        if (hasConflict) {
          isBlocked = true;
          blockReason = `Conflito com ${occupied.hora} (${occupied.duracao}min) - livre após ${occupied.fimComDelay}`;
          break;
        }
      }

      if (isBlocked) {
        slots.push({ time: timeStr, available: false, blockedReason: 'occupied' });
      } else {
        slots.push({ time: timeStr, available: true });
      }
    }

    const availableCount = slots.filter(s => s.available).length;
    const blockedCount = slots.filter(s => !s.available).length;

    console.log(`[check-availability] RESULTADO: ${slots.length} slots gerados | ${availableCount} disponíveis | ${blockedCount} bloqueados`);
    console.log('='.repeat(70));

    return new Response(
      JSON.stringify({
        success: true,
        date,
        slots,
        occupiedSlots,
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
