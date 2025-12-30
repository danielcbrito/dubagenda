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
 * IMPORTANTE: Cada barbeiro tem sua própria agenda!
 * - Se barbeiroId for passado, usa configuracoes_horario_barbeiro e horarios_excepcionais_barbeiro
 * - Senão, usa configuracoes_horario e horarios_excepcionais (agenda central)
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
  barbeiroId?: string; // Filtrar por barbeiro específico
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
  fim: string;
  fimComDelay: string;
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
    const { date, duration, excludeAppointmentId, barbeiroId } = body;

    console.log('='.repeat(70));
    console.log('[check-availability] INICIANDO VERIFICAÇÃO');
    console.log(`[check-availability] Data: ${date} | Duração: ${duration}min | Barbeiro: ${barbeiroId || 'CENTRAL'}`);

    if (!date || !duration || duration <= 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'Data e duração são obrigatórios' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const dateObj = new Date(date + 'T12:00:00');
    const dayOfWeek = dateObj.getDay();

    let config: BusinessHoursConfig;

    // ============================================
    // BUSCAR HORÁRIOS DO BARBEIRO (se especificado)
    // ============================================
    if (barbeiroId) {
      console.log(`[check-availability] Buscando horários do barbeiro ${barbeiroId}`);
      
      // Primeiro: verificar se existe exceção para esta data específica
      const { data: excecaoBarbeiro } = await supabase
        .from('horarios_excepcionais_barbeiro')
        .select('*')
        .eq('barbeiro_id', barbeiroId)
        .eq('data', date)
        .maybeSingle();

      if (excecaoBarbeiro) {
        console.log(`[check-availability] EXCEÇÃO do barbeiro encontrada para ${date}`);
        config = {
          aberto: excecaoBarbeiro.aberto ?? false,
          hora_abertura: excecaoBarbeiro.hora_abertura || '09:00',
          hora_fechamento: excecaoBarbeiro.hora_fechamento || '18:00',
          hora_almoco_inicio: excecaoBarbeiro.hora_almoco_inicio,
          hora_almoco_fim: excecaoBarbeiro.hora_almoco_fim,
          delay_entre_servicos: 10
        };
      } else {
        // Buscar configuração padrão do barbeiro para o dia da semana
        const { data: configBarbeiro } = await supabase
          .from('configuracoes_horario_barbeiro')
          .select('*')
          .eq('barbeiro_id', barbeiroId)
          .eq('dia_semana', dayOfWeek)
          .maybeSingle();

        if (configBarbeiro) {
          console.log(`[check-availability] Config do barbeiro para dia ${dayOfWeek} encontrada`);
          config = {
            aberto: configBarbeiro.aberto ?? true,
            hora_abertura: configBarbeiro.hora_abertura || '09:00',
            hora_fechamento: configBarbeiro.hora_fechamento || '18:00',
            hora_almoco_inicio: configBarbeiro.hora_almoco_inicio,
            hora_almoco_fim: configBarbeiro.hora_almoco_fim,
            delay_entre_servicos: configBarbeiro.delay_entre_servicos || 10
          };
        } else {
          // Fallback: usar config global se barbeiro não tem config própria
          console.log(`[check-availability] Barbeiro sem config, usando config global`);
          const { data: configGlobal } = await supabase
            .from('configuracoes_horario')
            .select('*')
            .eq('dia_semana', dayOfWeek)
            .maybeSingle();

          config = configGlobal ? {
            aberto: configGlobal.aberto,
            hora_abertura: configGlobal.hora_abertura,
            hora_fechamento: configGlobal.hora_fechamento,
            hora_almoco_inicio: configGlobal.hora_almoco_inicio,
            hora_almoco_fim: configGlobal.hora_almoco_fim,
            delay_entre_servicos: configGlobal.delay_entre_servicos || 10
          } : {
            aberto: dayOfWeek !== 0,
            hora_abertura: '09:00',
            hora_fechamento: '18:00',
            hora_almoco_inicio: '12:00',
            hora_almoco_fim: '13:00',
            delay_entre_servicos: 10
          };
        }
      }
    } else {
      // ============================================
      // AGENDA CENTRAL (sem barbeiro específico)
      // ============================================
      const { data: excecaoData } = await supabase
        .from('horarios_excepcionais')
        .select('*')
        .eq('data', date)
        .maybeSingle();

      if (excecaoData) {
        console.log(`[check-availability] EXCEÇÃO CENTRAL encontrada para ${date}`);
        config = {
          aberto: excecaoData.aberto,
          hora_abertura: excecaoData.hora_abertura || '09:00',
          hora_fechamento: excecaoData.hora_fechamento || '20:00',
          hora_almoco_inicio: excecaoData.hora_almoco_inicio,
          hora_almoco_fim: excecaoData.hora_almoco_fim,
          delay_entre_servicos: 10
        };
      } else {
        const { data: configData } = await supabase
          .from('configuracoes_horario')
          .select('*')
          .eq('dia_semana', dayOfWeek)
          .maybeSingle();

        config = configData ? {
          aberto: configData.aberto,
          hora_abertura: configData.hora_abertura,
          hora_fechamento: configData.hora_fechamento,
          hora_almoco_inicio: configData.hora_almoco_inicio,
          hora_almoco_fim: configData.hora_almoco_fim,
          delay_entre_servicos: configData.delay_entre_servicos || 10
        } : {
          aberto: dayOfWeek !== 0,
          hora_abertura: '09:00',
          hora_fechamento: '21:00',
          hora_almoco_inicio: '13:00',
          hora_almoco_fim: '14:00',
          delay_entre_servicos: 10
        };
      }
    }

    console.log(`[check-availability] Config final:`, JSON.stringify(config));

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

    console.log(`[check-availability] Horário: ${minutesToTime(OPEN_MINUTES)}-${minutesToTime(CLOSE_MINUTES)} | Delay: ${DELAY_MINUTES}min`);

    // ============================================
    // BUSCAR AGENDAMENTOS - FILTRAR POR BARBEIRO
    // ============================================
    let appointmentsQuery = supabase
      .from('agendamentos')
      .select('id, hora, duracao, status, barbeiro_id')
      .eq('data', date)
      .in('status', BLOCKING_STATUSES);

    if (excludeAppointmentId) {
      appointmentsQuery = appointmentsQuery.neq('id', excludeAppointmentId);
    }

    // CRÍTICO: Filtrar por barbeiro específico
    if (barbeiroId) {
      appointmentsQuery = appointmentsQuery.eq('barbeiro_id', barbeiroId);
    }

    const { data: appointments, error: aptError } = await appointmentsQuery;

    if (aptError) {
      console.error('[check-availability] ERRO ao buscar agendamentos:', aptError);
      return new Response(
        JSON.stringify({ success: false, message: 'Erro ao verificar disponibilidade' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // ============================================
    // BUSCAR PENDING BOOKINGS - FILTRAR POR BARBEIRO
    // ============================================
    const now = new Date();
    let pendingQuery = supabase
      .from('pending_bookings')
      .select('id, hora, duracao, expires_at, barbeiro_id')
      .eq('data', date)
      .gt('expires_at', now.toISOString());

    // CRÍTICO: Filtrar por barbeiro específico
    if (barbeiroId) {
      pendingQuery = pendingQuery.eq('barbeiro_id', barbeiroId);
    }

    const { data: pendingBookings, error: pbError } = await pendingQuery;

    if (pbError) {
      console.log('[check-availability] Aviso ao buscar pending:', pbError.message);
    }

    console.log(`[check-availability] Agendamentos do barbeiro: ${appointments?.length || 0}`);
    console.log(`[check-availability] Pending bookings do barbeiro: ${pendingBookings?.length || 0}`);

    // Processar slots ocupados
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
      console.log(`[check-availability] → Agendamento: ${apt.hora} (${apt.duracao}min) | Livre após: ${info.fimComDelay}`);
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
      console.log(`[check-availability] → Pending: ${pb.hora} (${pb.duracao}min) | Livre após: ${info.fimComDelay}`);
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
        continue;
      }

      // 2. Verificar almoço
      if (LUNCH_START !== null && LUNCH_END !== null) {
        if (slotStartMinutes >= LUNCH_START && slotStartMinutes < LUNCH_END) {
          continue;
        }
        if (slotEndMinutes > LUNCH_START && slotEndMinutes <= LUNCH_END) {
          continue;
        }
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
      let isBlocked = false;

      for (const occupied of occupiedSlots) {
        const occStartMinutes = timeToMinutes(occupied.hora);
        const occEndMinutes = occStartMinutes + occupied.duracao;
        const occEndWithDelayMinutes = occEndMinutes + DELAY_MINUTES;

        const hasConflict = (slotStartMinutes < occEndWithDelayMinutes) && (slotEndMinutes > occStartMinutes);

        if (hasConflict) {
          isBlocked = true;
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

    console.log(`[check-availability] RESULTADO: ${slots.length} slots | ${availableCount} disponíveis | ${blockedCount} bloqueados`);
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
