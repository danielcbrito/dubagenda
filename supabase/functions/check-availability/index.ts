/**
 * CHECK-AVAILABILITY EDGE FUNCTION — V5 (2026-03-04)
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
 * ISOLAMENTO: barbeiroId é OBRIGATÓRIO para retorno de slots válidos.
 * Sem barbeiroId, retorna erro 400 (não slots vazios).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
  barbeiroId?: string;
  barberId?: string; // compatibilidade retroativa
  tenantId?: string | null;
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

// Helper function to get default business hours config
async function getDefaultConfig(supabase: any, date: string, dayOfWeek: number): Promise<BusinessHoursConfig> {
  // Primeiro: Verificar exceção geral para esta data
  const { data: excecaoData, error: excecaoError } = await supabase
    .from('horarios_excepcionais')
    .select('*')
    .eq('data', date)
    .maybeSingle();

  if (excecaoError) {
    console.log('[check-availability] Erro ao buscar exceção:', excecaoError.message);
  }

  if (excecaoData) {
    console.log(`[check-availability] EXCEÇÃO GERAL encontrada para ${date}`);
    return {
      aberto: excecaoData.aberto,
      hora_abertura: excecaoData.hora_abertura || '09:00',
      hora_fechamento: excecaoData.hora_fechamento || '20:00',
      hora_almoco_inicio: excecaoData.hora_almoco_inicio,
      hora_almoco_fim: excecaoData.hora_almoco_fim,
      delay_entre_servicos: 10
    };
  }

  // Buscar configurações padrão do dia da semana
  const { data: configData, error: configError } = await supabase
    .from('configuracoes_horario')
    .select('*')
    .eq('dia_semana', dayOfWeek)
    .maybeSingle();

  if (configError) {
    console.log('[check-availability] Erro ao buscar config:', configError.message);
  }

  if (!configData) {
    console.warn(`[check-availability] ATENÇÃO: Nenhuma configuração para dia ${dayOfWeek}. Usando padrão.`);
  }

  return configData ? {
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

async function resolveScopedBarberIds(
  supabase: any,
  tenantId: string | null
): Promise<string[]> {
  let query = supabase
    .from('barbeiros')
    .select('id')
    .eq('ativo', true);

  if (tenantId === null) {
    query = query.is('tenant_id', null);
  } else {
    query = query.eq('tenant_id', tenantId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[check-availability] Erro ao resolver barbeiros do escopo:', error.message);
    return [];
  }

  return (data || []).map((barber: { id: string }) => barber.id);
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
    const { date, duration, excludeAppointmentId, barbeiroId, barberId, tenantId } = body;
    const resolvedBarbeiroId = barbeiroId ?? barberId;

    console.log('='.repeat(70));
    console.log('[check-availability] INICIANDO VERIFICAÇÃO');
    console.log(`[check-availability] Data: ${date} | Duração solicitada: ${duration}min | Barbeiro: ${resolvedBarbeiroId || 'N/A'} | Tenant: ${tenantId === null ? 'DUB' : (tenantId || 'N/A')}`);

    if (!date || !duration || duration <= 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'Data e duração são obrigatórios' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!resolvedBarbeiroId && tenantId === undefined) {
      return new Response(
        JSON.stringify({ success: false, message: 'Contexto inválido: informe barbeiroId/barberId ou tenantId.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const dateObj = new Date(date + 'T12:00:00');
    const dayOfWeek = dateObj.getDay();

    // BUSCAR CONFIGURAÇÃO DE HORÁRIO
    // Prioridade: 1) Exceção do barbeiro, 2) Exceção geral, 3) Config do barbeiro, 4) Config geral
    let config: BusinessHoursConfig;

    if (resolvedBarbeiroId) {
      // Se barbeiro especificado, verificar exceções e config do barbeiro
      const { data: excecaoBarbeiroData } = await supabase
        .from('horarios_excepcionais_barbeiro')
        .select('*')
        .eq('data', date)
        .eq('barbeiro_id', resolvedBarbeiroId)
        .maybeSingle();

      if (excecaoBarbeiroData) {
        console.log(`[check-availability] EXCEÇÃO DO BARBEIRO encontrada para ${date}`);
        config = {
          aberto: excecaoBarbeiroData.aberto ?? true,
          hora_abertura: excecaoBarbeiroData.hora_abertura || '09:00',
          hora_fechamento: excecaoBarbeiroData.hora_fechamento || '20:00',
          hora_almoco_inicio: excecaoBarbeiroData.hora_almoco_inicio,
          hora_almoco_fim: excecaoBarbeiroData.hora_almoco_fim,
          delay_entre_servicos: 10
        };
      } else {
        // IMPORTANTE: Verificar exceção GLOBAL antes de usar config do barbeiro
        // Exceções globais (feriados, folgas) devem ter prioridade sobre config padrão do barbeiro
        const { data: excecaoGlobalData } = await supabase
          .from('horarios_excepcionais')
          .select('*')
          .eq('data', date)
          .maybeSingle();

        if (excecaoGlobalData) {
          console.log(`[check-availability] EXCEÇÃO GLOBAL encontrada para ${date} (barbeiro ${resolvedBarbeiroId})`);
          config = {
            aberto: excecaoGlobalData.aberto,
            hora_abertura: excecaoGlobalData.hora_abertura || '09:00',
            hora_fechamento: excecaoGlobalData.hora_fechamento || '20:00',
            hora_almoco_inicio: excecaoGlobalData.hora_almoco_inicio,
            hora_almoco_fim: excecaoGlobalData.hora_almoco_fim,
            delay_entre_servicos: 10
          };
        } else {
          // Buscar config padrão do barbeiro
          const { data: configBarbeiroData } = await supabase
            .from('configuracoes_horario_barbeiro')
            .select('*')
            .eq('barbeiro_id', resolvedBarbeiroId)
            .eq('dia_semana', dayOfWeek)
            .maybeSingle();

          if (configBarbeiroData) {
            console.log(`[check-availability] Config do barbeiro ${resolvedBarbeiroId} para dia ${dayOfWeek}:`, JSON.stringify({
              aberto: configBarbeiroData.aberto,
              hora_almoco_inicio: configBarbeiroData.hora_almoco_inicio,
              hora_almoco_fim: configBarbeiroData.hora_almoco_fim,
              hora_abertura: configBarbeiroData.hora_abertura,
              hora_fechamento: configBarbeiroData.hora_fechamento,
            }));
            config = {
              aberto: configBarbeiroData.aberto !== null ? configBarbeiroData.aberto : true,
              hora_abertura: configBarbeiroData.hora_abertura || '09:00',
              hora_fechamento: configBarbeiroData.hora_fechamento || '20:00',
              hora_almoco_inicio: configBarbeiroData.hora_almoco_inicio || null,
              hora_almoco_fim: configBarbeiroData.hora_almoco_fim || null,
              delay_entre_servicos: configBarbeiroData.delay_entre_servicos || 10
            };
          } else {
            console.log(`[check-availability] Sem config para barbeiro ${resolvedBarbeiroId} dia ${dayOfWeek}, usando global`);
            // Fallback para config geral (já verifica horarios_excepcionais)
            config = await getDefaultConfig(supabase, date, dayOfWeek);
          }
        }
      }
    } else {
      // Sem barbeiro - usar config geral
      config = await getDefaultConfig(supabase, date, dayOfWeek);
    }

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

    // Resolver escopo de conflito (barbeiro específico ou tenant inteiro)
    let scopedBarberIds: string[] | null = null;

    if (!resolvedBarbeiroId) {
      scopedBarberIds = await resolveScopedBarberIds(supabase, tenantId ?? null);
      console.log(`[check-availability] Escopo por tenant: ${tenantId === null ? 'DUB' : tenantId} | Barbeiros ativos: ${scopedBarberIds.length}`);
    }

    const now = new Date();
    let appointments: Array<{ id: string; hora: string; duracao: number; status: string; barbeiro_id: string | null }> = [];
    let pendingBookings: Array<{ id: string; hora: string; duracao: number; expires_at: string; barbeiro_id: string | null }> = [];

    const shouldQueryByScope = Boolean(resolvedBarbeiroId) || Boolean(scopedBarberIds && scopedBarberIds.length > 0);

    if (shouldQueryByScope) {
      // Buscar agendamentos com status bloqueante
      let appointmentsQuery = supabase
        .from('agendamentos')
        .select('id, hora, duracao, status, barbeiro_id')
        .eq('data', date)
        .in('status', BLOCKING_STATUSES);

      if (resolvedBarbeiroId) {
        appointmentsQuery = appointmentsQuery.eq('barbeiro_id', resolvedBarbeiroId);
      } else if (scopedBarberIds) {
        appointmentsQuery = appointmentsQuery.in('barbeiro_id', scopedBarberIds);
      }

      if (excludeAppointmentId) {
        appointmentsQuery = appointmentsQuery.neq('id', excludeAppointmentId);
      }

      const { data: appointmentsData, error: aptError } = await appointmentsQuery;

      if (aptError) {
        console.error('[check-availability] ERRO ao buscar agendamentos:', aptError);
        return new Response(
          JSON.stringify({ success: false, message: 'Erro ao verificar disponibilidade' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      appointments = appointmentsData || [];

      // Buscar pending bookings não expirados
      let pendingQuery = supabase
        .from('pending_bookings')
        .select('id, hora, duracao, expires_at, barbeiro_id')
        .eq('data', date)
        .gt('expires_at', now.toISOString());

      if (resolvedBarbeiroId) {
        pendingQuery = pendingQuery.eq('barbeiro_id', resolvedBarbeiroId);
      } else if (scopedBarberIds) {
        pendingQuery = pendingQuery.in('barbeiro_id', scopedBarberIds);
      }

      const { data: pendingData, error: pbError } = await pendingQuery;

      if (pbError) {
        console.log('[check-availability] Aviso ao buscar pending:', pbError.message);
      }

      pendingBookings = pendingData || [];
    }

    console.log(`[check-availability] Agendamentos encontrados: ${appointments.length}`);
    console.log(`[check-availability] Pending bookings encontrados: ${pendingBookings.length}`);

    // Processar todos os slots ocupados com cálculo correto de fim + delay
    const occupiedSlots: OccupiedSlotInfo[] = [];

    for (const apt of appointments || []) {
      const startMinutes = timeToMinutes(apt.hora);
      const endMinutes = startMinutes + apt.duracao;
      const endWithDelayMinutes = endMinutes + DELAY_MINUTES;
      const info: OccupiedSlotInfo = {
        hora: apt.hora, duracao: apt.duracao, status: apt.status, source: 'agendamento',
        fim: minutesToTime(endMinutes), fimComDelay: minutesToTime(endWithDelayMinutes)
      };
      occupiedSlots.push(info);
      console.log(`[check-availability] → Agendamento: ${apt.hora} (${apt.duracao}min) | Fim: ${info.fim} | Livre após: ${info.fimComDelay}`);
    }

    for (const pb of pendingBookings || []) {
      const startMinutes = timeToMinutes(pb.hora);
      const endMinutes = startMinutes + pb.duracao;
      const endWithDelayMinutes = endMinutes + DELAY_MINUTES;
      const info: OccupiedSlotInfo = {
        hora: pb.hora, duracao: pb.duracao, status: 'pending_booking', source: 'pending_booking',
        fim: minutesToTime(endMinutes), fimComDelay: minutesToTime(endWithDelayMinutes)
      };
      occupiedSlots.push(info);
      console.log(`[check-availability] → Pending: ${pb.hora} (${pb.duracao}min) | Fim: ${info.fim} | Livre após: ${info.fimComDelay}`);
    }

    // CRITICAL: Converter para horário de Brasília (UTC-3) para comparação correta
    const brasilNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const brasilTodayStr = `${brasilNow.getFullYear()}-${String(brasilNow.getMonth() + 1).padStart(2, '0')}-${String(brasilNow.getDate()).padStart(2, '0')}`;
    const isToday = date === brasilTodayStr;
    const currentMinutes = brasilNow.getHours() * 60 + brasilNow.getMinutes();
    const minimumAdvanceMinutes = isToday ? currentMinutes + 30 : 0;

    if (isToday) {
      console.log(`[check-availability] É HOJE (BRT) - Hora atual: ${minutesToTime(currentMinutes)} | Mínimo: ${minutesToTime(minimumAdvanceMinutes)}`);
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

      // 2. Verificar almoço - qualquer sobreposição entre [slotStart, slotEnd] e [LUNCH_START, LUNCH_END] bloqueia
      // Regra: sobreposição existe quando slotStart < LUNCH_END E slotEnd > LUNCH_START
      if (LUNCH_START !== null && LUNCH_END !== null) {
        if (slotStartMinutes < LUNCH_END && slotEndMinutes > LUNCH_START) {
          slots.push({ time: timeStr, available: false, blockedReason: 'lunch' });
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
