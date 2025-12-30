/**
 * VALIDATE-APPOINTMENT EDGE FUNCTION
 * 
 * Validação ATÔMICA de disponibilidade de horário.
 * Verifica horário de funcionamento, almoço, conflitos com agendamentos e pending_bookings.
 * 
 * IMPORTANTE: Cada barbeiro tem sua própria agenda!
 * - Se barbeiroId for passado, usa configuracoes_horario_barbeiro
 * - Filtra agendamentos e pending_bookings por barbeiro_id
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AppointmentRequest {
  data: string;
  hora: string;
  duracao: number;
  userId: string;
  excludeAppointmentId?: string;
  barbeiroId?: string; // Barbeiro específico para validação
}

interface BusinessHoursConfig {
  aberto: boolean;
  hora_abertura: string;
  hora_fechamento: string;
  hora_almoco_inicio: string | null;
  hora_almoco_fim: string | null;
  delay_entre_servicos: number;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, hora, duracao, userId, excludeAppointmentId, barbeiroId }: AppointmentRequest = await req.json();
    
    console.log('[validate-appointment] Validando:', { data, hora, duracao, userId, barbeiroId, excludeAppointmentId });

    const appointmentDate = new Date(data + 'T12:00:00');
    const dayOfWeek = appointmentDate.getDay();

    let config: BusinessHoursConfig;

    // ============================================
    // BUSCAR HORÁRIOS DO BARBEIRO (se especificado)
    // ============================================
    if (barbeiroId) {
      console.log(`[validate-appointment] Buscando horários do barbeiro ${barbeiroId}`);
      
      // Verificar exceção para esta data
      const { data: excecaoBarbeiro } = await supabase
        .from('horarios_excepcionais_barbeiro')
        .select('*')
        .eq('barbeiro_id', barbeiroId)
        .eq('data', data)
        .maybeSingle();

      if (excecaoBarbeiro) {
        config = {
          aberto: excecaoBarbeiro.aberto ?? false,
          hora_abertura: excecaoBarbeiro.hora_abertura || '09:00',
          hora_fechamento: excecaoBarbeiro.hora_fechamento || '18:00',
          hora_almoco_inicio: excecaoBarbeiro.hora_almoco_inicio,
          hora_almoco_fim: excecaoBarbeiro.hora_almoco_fim,
          delay_entre_servicos: 10
        };
      } else {
        // Buscar config padrão do barbeiro
        const { data: configBarbeiro } = await supabase
          .from('configuracoes_horario_barbeiro')
          .select('*')
          .eq('barbeiro_id', barbeiroId)
          .eq('dia_semana', dayOfWeek)
          .maybeSingle();

        if (configBarbeiro) {
          config = {
            aberto: configBarbeiro.aberto ?? true,
            hora_abertura: configBarbeiro.hora_abertura || '09:00',
            hora_fechamento: configBarbeiro.hora_fechamento || '18:00',
            hora_almoco_inicio: configBarbeiro.hora_almoco_inicio,
            hora_almoco_fim: configBarbeiro.hora_almoco_fim,
            delay_entre_servicos: configBarbeiro.delay_entre_servicos || 10
          };
        } else {
          // Fallback: config global
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

    console.log(`[validate-appointment] Config:`, JSON.stringify(config));

    // Check if day is closed
    if (!config.aberto) {
      console.log('[validate-appointment] Rejeitado: Dia fechado');
      return new Response(
        JSON.stringify({ valid: false, message: 'A barbearia não funciona neste dia.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const [startHour, startMinute] = hora.split(':').map(Number);
    const startTimeInMinutes = startHour * 60 + startMinute;
    const endTimeInMinutes = startTimeInMinutes + duracao;

    const OPEN_MINUTES = timeToMinutes(config.hora_abertura);
    const CLOSE_MINUTES = timeToMinutes(config.hora_fechamento);
    const LUNCH_START = config.hora_almoco_inicio ? timeToMinutes(config.hora_almoco_inicio) : null;
    const LUNCH_END = config.hora_almoco_fim ? timeToMinutes(config.hora_almoco_fim) : null;
    const DELAY_MINUTES = config.delay_entre_servicos;

    // Check lunch break
    if (LUNCH_START !== null && LUNCH_END !== null) {
      if (
        (startTimeInMinutes >= LUNCH_START && startTimeInMinutes < LUNCH_END) ||
        (endTimeInMinutes > LUNCH_START && endTimeInMinutes <= LUNCH_END) ||
        (startTimeInMinutes < LUNCH_START && endTimeInMinutes > LUNCH_END)
      ) {
        console.log('[validate-appointment] Rejeitado: Horário de almoço');
        return new Response(
          JSON.stringify({ 
            valid: false, 
            message: `Horário de almoço (${config.hora_almoco_inicio}-${config.hora_almoco_fim}).` 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    }

    // Check business hours
    if (startTimeInMinutes < OPEN_MINUTES || endTimeInMinutes > CLOSE_MINUTES) {
      console.log('[validate-appointment] Rejeitado: Fora do expediente');
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: `Horário fora do expediente (${config.hora_abertura}-${config.hora_fechamento}).` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // ============================================
    // VERIFICAR CONFLITOS - FILTRAR POR BARBEIRO
    // ============================================
    let agendamentosQuery = supabase
      .from('agendamentos')
      .select('id, hora, duracao, status')
      .eq('data', data)
      .in('status', ['pending', 'confirmed', 'completed']);
    
    if (excludeAppointmentId) {
      agendamentosQuery = agendamentosQuery.neq('id', excludeAppointmentId);
    }

    // CRÍTICO: Filtrar por barbeiro específico
    if (barbeiroId) {
      agendamentosQuery = agendamentosQuery.eq('barbeiro_id', barbeiroId);
    }

    const { data: existingAppointments, error: aptError } = await agendamentosQuery;

    if (aptError) {
      console.error('[validate-appointment] Erro ao buscar agendamentos:', aptError);
      return new Response(
        JSON.stringify({ valid: false, message: 'Erro ao verificar disponibilidade' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Check conflicts with existing appointments
    for (const apt of existingAppointments || []) {
      const [aptHour, aptMinute] = apt.hora.split(':').map(Number);
      const aptStart = aptHour * 60 + aptMinute;
      const aptEnd = aptStart + apt.duracao;
      const aptEndWithDelay = aptEnd + DELAY_MINUTES;

      const hasConflict = startTimeInMinutes < aptEndWithDelay && endTimeInMinutes > aptStart;

      if (hasConflict) {
        console.log('[validate-appointment] CONFLITO com agendamento:', apt.id);
        return new Response(
          JSON.stringify({ 
            valid: false, 
            message: 'Horário indisponível. Já existe um agendamento nesse período.' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    }

    // ============================================
    // VERIFICAR PENDING BOOKINGS - FILTRAR POR BARBEIRO
    // ============================================
    let pendingQuery = supabase
      .from('pending_bookings')
      .select('id, hora, duracao, expires_at')
      .eq('data', data)
      .gt('expires_at', new Date().toISOString());

    // CRÍTICO: Filtrar por barbeiro específico
    if (barbeiroId) {
      pendingQuery = pendingQuery.eq('barbeiro_id', barbeiroId);
    }

    const { data: pendingBookings, error: pendingError } = await pendingQuery;

    if (pendingError) {
      console.error('[validate-appointment] Erro ao buscar pending_bookings:', pendingError);
    }

    for (const pending of pendingBookings || []) {
      const [pendingHour, pendingMinute] = pending.hora.split(':').map(Number);
      const pendingStart = pendingHour * 60 + pendingMinute;
      const pendingEnd = pendingStart + pending.duracao;
      const pendingEndWithDelay = pendingEnd + DELAY_MINUTES;

      const hasConflict = startTimeInMinutes < pendingEndWithDelay && endTimeInMinutes > pendingStart;

      if (hasConflict) {
        console.log('[validate-appointment] CONFLITO com pending_booking:', pending.id);
        return new Response(
          JSON.stringify({ 
            valid: false, 
            message: 'Horário temporariamente reservado. Tente outro horário ou aguarde alguns minutos.' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    }

    console.log('[validate-appointment] Horário DISPONÍVEL:', { data, hora, duracao });
    return new Response(
      JSON.stringify({ valid: true, message: 'Horário disponível' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[validate-appointment] Erro:', error);
    return new Response(
      JSON.stringify({ valid: false, message: 'Erro interno do servidor' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
