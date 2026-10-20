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
  barberId?: string; // compatibilidade atual
  barbeiroId?: string; // compatibilidade retroativa
  excludeAppointmentId?: string; // Para reagendamentos - excluir o agendamento atual
  tipoAgendamento?: string;
  planoId?: string;
  assinaturaId?: string;
}

interface BusinessHoursConfig {
  aberto: boolean;
  hora_abertura: string;
  hora_fechamento: string;
  hora_almoco_inicio: string | null;
  hora_almoco_fim: string | null;
  delay_entre_servicos: number;
}

// Helper function: convert HH:MM to minutes
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Edge Function para validação ATÔMICA de disponibilidade de horário.
 * 
 * Esta função é CRÍTICA para evitar agendamentos duplicados.
 * Ela verifica:
 * 1. Horário de funcionamento (DINÂMICO do banco de dados)
 * 2. Horário de almoço (DINÂMICO do banco de dados)
 * 3. Dias de funcionamento (DINÂMICO do banco de dados)
 * 4. Conflitos com agendamentos existentes (considerando duração + buffer)
 * 5. Conflitos com pending_bookings (reservas aguardando pagamento)
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, hora, duracao, userId, barberId, barbeiroId, excludeAppointmentId, tipoAgendamento, planoId, assinaturaId }: AppointmentRequest = await req.json();
    const resolvedBarberId = barberId ?? barbeiroId;
    let tenantId: string | null = null;
    
    console.log('[validate-appointment] Iniciando validação:', { data, hora, duracao, userId, barberId: resolvedBarberId, excludeAppointmentId, tipoAgendamento, planoId });

    if (!resolvedBarberId) {
      return new Response(
        JSON.stringify({ valid: false, message: 'Selecione um profissional para continuar.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const { data: barberScope } = await supabase
      .from('barbeiros')
      .select('tenant_id')
      .eq('id', resolvedBarberId)
      .maybeSingle();
    tenantId = barberScope?.tenant_id ?? null;

    // Parse the date and get day of week
    const appointmentDate = new Date(data + 'T12:00:00'); // Parse as local date
    const dayOfWeek = appointmentDate.getDay();

    // ============================================
    // VALIDAÇÃO EXCLUSIVA: BARBEARIA VIP & PLANOS RESTRICTOS
    // Contas com plano na Barbearia VIP Exclusive só podem agendar terça (2), quarta (3) e quinta (4)
    // ============================================
    const isVipTenant = tenantId === '5e825363-70ff-4abe-9143-9e87758437e7';
    let isPlanBooking = tipoAgendamento === 'plano' || !!planoId || !!assinaturaId;

    if (!isPlanBooking && userId) {
      const { data: userSub } = await supabase
        .from('assinaturas')
        .select('id, status, plano_id, plano:planos(tenant_id, nome)')
        .eq('user_id', userId)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

      if (userSub && ((userSub.plano as any)?.tenant_id === '5e825363-70ff-4abe-9143-9e87758437e7' || isVipTenant)) {
        isPlanBooking = true;
      }
    }

    if (isPlanBooking && (isVipTenant || planoId === 'ce9b4790-8dda-4ae4-89fc-91147a104c08')) {
      if (![2, 3, 4].includes(dayOfWeek)) {
        console.log('[validate-appointment] Rejeitado: Agendamento de plano VIP fora de terça, quarta e quinta. Dia:', dayOfWeek);
        return new Response(
          JSON.stringify({
            valid: false,
            message: 'Agendamentos com plano nesta barbearia são permitidos exclusivamente às terças, quartas e quintas-feiras.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    }

    // ============================================
    // BUSCAR CONFIGURAÇÕES DE HORÁRIO DO BANCO
    // Prioridade:
    // 1) Exceção do barbeiro
    // 2) Exceção da barbearia (tenant)
    // 3) Horário base da barbearia (configuracoes_horario_unidade -> fallback configuracoes_horario)
    // 4) Horário do barbeiro (configuracoes_horario_barbeiro), respeitando limites da barbearia
    // ============================================
    let configData: any = null;
    let configError: any = null;

    // 1) Exceção do barbeiro para esta data
    if (resolvedBarberId) {
      const result = await supabase
        .from('horarios_excepcionais_barbeiro')
        .select('*')
        .eq('barbeiro_id', resolvedBarberId)
        .eq('data', data)
        .maybeSingle();
      if (result.data) {
        console.log('[validate-appointment] EXCEÇÃO DO BARBEIRO encontrada');
        configData = result.data;
      }
    }

    // 2) Exceção da barbearia para esta data
    let storeException: any = null;
    if (!configData) {
      let globalExceptionQuery = supabase
        .from('horarios_excepcionais')
        .select('*')
        .eq('data', data);
      if (tenantId) globalExceptionQuery = globalExceptionQuery.eq('tenant_id', tenantId);
      const result = await globalExceptionQuery.maybeSingle();
      if (result.data) {
        console.log('[validate-appointment] EXCEÇÃO DA BARBEARIA encontrada');
        storeException = result.data;
        configData = result.data;
      }
    }

    // 3) Horário base da barbearia (configuracoes_horario_unidade -> fallback configuracoes_horario)
    let storeConfig: any = storeException;
    if (!storeConfig && tenantId) {
      const result = await supabase
        .from('configuracoes_horario_unidade')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('dia_semana', dayOfWeek)
        .order('unidade_id', { nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (result.data) {
        storeConfig = result.data;
      }
    }
    if (!storeConfig) {
      const result = await supabase
        .from('configuracoes_horario')
        .select('*')
        .eq('dia_semana', dayOfWeek)
        .maybeSingle();
      if (result.data) {
        storeConfig = result.data;
      }
    }

    // Se a barbearia estiver fechada neste dia, agendamento é rejeitado
    if (storeConfig && storeConfig.aberto === false) {
      console.log('[validate-appointment] Rejeitado: Barbearia fechada neste dia');
      return new Response(
        JSON.stringify({
          valid: false,
          message: 'A barbearia não funciona neste dia.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // 4) Config padrão do barbeiro para o dia da semana
    if (!configData && resolvedBarberId) {
      const result = await supabase
        .from('configuracoes_horario_barbeiro')
        .select('*')
        .eq('barbeiro_id', resolvedBarberId)
        .eq('dia_semana', dayOfWeek)
        .maybeSingle();
      if (result.data && result.data.aberto !== null) {
        configData = result.data;
      }
      configError = result.error;
    }

    // 5) Fallback para a config da barbearia
    if (!configData && storeConfig) {
      configData = storeConfig;
    }

    if (configError) {
      console.error('[validate-appointment] Erro ao buscar config:', configError.message);
    }

    // NUNCA usar valores hardcoded - sempre preferir dados do banco
    const config: BusinessHoursConfig = configData ? {
      aberto: configData.aberto ?? true,
      hora_abertura: configData.hora_abertura || '09:00',
      hora_fechamento: configData.hora_fechamento || '21:00',
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

    // ISOLAMENTO DE EXPEDIENTE: Se a barbearia estiver fechada no dia, rejeita agendamento.
    if (storeConfig && storeConfig.aberto === false) {
      config.aberto = false;
    }

    console.log(`[validate-appointment] Config do dia ${dayOfWeek}:`, JSON.stringify(config));

    // Check if day is closed
    if (!config.aberto) {
      console.log('[validate-appointment] Rejeitado: Dia fechado');
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: 'O profissional não atende neste dia.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Parse the time to get start time in minutes
    const [startHour, startMinute] = hora.split(':').map(Number);
    const startTimeInMinutes = startHour * 60 + startMinute;
    const endTimeInMinutes = startTimeInMinutes + duracao;

    // Get business hours from config
    const OPEN_MINUTES = timeToMinutes(config.hora_abertura);
    const CLOSE_MINUTES = timeToMinutes(config.hora_fechamento);
    const LUNCH_START = config.hora_almoco_inicio ? timeToMinutes(config.hora_almoco_inicio) : null;
    const LUNCH_END = config.hora_almoco_fim ? timeToMinutes(config.hora_almoco_fim) : null;

    // Block lunch break (if configured)
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
            message: `Horário indisponível. A barbearia está fechada para almoço entre ${config.hora_almoco_inicio} e ${config.hora_almoco_fim}.` 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    }

    // Validate business hours (DYNAMIC from database)
    if (startTimeInMinutes < OPEN_MINUTES || endTimeInMinutes > CLOSE_MINUTES) {
      console.log('[validate-appointment] Rejeitado: Fora do expediente', {
        requested: `${startTimeInMinutes}-${endTimeInMinutes}`,
        allowed: `${OPEN_MINUTES}-${CLOSE_MINUTES}`
      });
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: `Horário fora do expediente. Funcionamento: ${config.hora_abertura} às ${config.hora_fechamento}.` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // ============================================
    // VERIFICAÇÃO CRÍTICA: Conflitos de agendamentos
    // ============================================
    
    // Build query to check for conflicts in agendamentos
    // INCLUIR todos os status que bloqueiam (pending, confirmed, completed)
    let agendamentosQuery = supabase
      .from('agendamentos')
      .select('id, hora, duracao, status')
      .eq('data', data)
      .in('status', ['pending', 'confirmed', 'completed']);
    
    // Filtrar estritamente por barbeiro
    if (resolvedBarberId) {
      agendamentosQuery = agendamentosQuery.eq('barbeiro_id', resolvedBarberId);
    }
    
    // Excluir o próprio agendamento (para reagendamentos)
    if (excludeAppointmentId) {
      agendamentosQuery = agendamentosQuery.neq('id', excludeAppointmentId);
    }

    const { data: existingAppointments, error: aptError } = await agendamentosQuery;

    if (aptError) {
      console.error('[validate-appointment] Erro ao buscar agendamentos:', aptError);
      return new Response(
        JSON.stringify({ valid: false, message: 'Erro ao verificar disponibilidade' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Check for time conflicts with existing appointments
    // Sem intervalo entre serviços
    const DELAY_MINUTES = 0;
    
    for (const apt of existingAppointments || []) {
      const [aptHour, aptMinute] = apt.hora.split(':').map(Number);
      const aptStart = aptHour * 60 + aptMinute;
      const aptEnd = aptStart + apt.duracao;
      const aptEndWithDelay = aptEnd + DELAY_MINUTES;

      // Check for overlap: dois intervalos se sobrepõem quando início1 < fim2+delay E fim1 > início2
      const hasConflict = startTimeInMinutes < aptEndWithDelay && endTimeInMinutes > aptStart;

      if (hasConflict) {
        console.log('[validate-appointment] CONFLITO com agendamento:', { 
          requestedTime: hora, 
          conflictingTime: apt.hora,
          requestedDuration: duracao,
          conflictingDuration: apt.duracao,
          aptId: apt.id
        });
        
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
    // VERIFICAÇÃO ADICIONAL: Pending Bookings (reservas aguardando pagamento)
    // ============================================
    let pendingQuery = supabase
      .from('pending_bookings')
      .select('id, hora, duracao, expires_at')
      .eq('data', data)
      .gt('expires_at', new Date().toISOString());
    
    if (resolvedBarberId) {
      pendingQuery = pendingQuery.eq('barbeiro_id', resolvedBarberId);
    }

    const { data: pendingBookings, error: pendingError } = await pendingQuery;

    if (pendingError) {
      console.error('[validate-appointment] Erro ao buscar pending_bookings:', pendingError);
      // Continue mesmo com erro - não bloquear por causa de pending_bookings
    }

    // Check for conflicts with pending bookings
    for (const pending of pendingBookings || []) {
      const [pendingHour, pendingMinute] = pending.hora.split(':').map(Number);
      const pendingStart = pendingHour * 60 + pendingMinute;
      const pendingEnd = pendingStart + pending.duracao;
      const pendingEndWithDelay = pendingEnd + DELAY_MINUTES;

      // Overlap: início1 < fim2+delay E fim1 > início2
      const hasConflict = startTimeInMinutes < pendingEndWithDelay && endTimeInMinutes > pendingStart;

      if (hasConflict) {
        console.log('[validate-appointment] CONFLITO com pending_booking:', { 
          requestedTime: hora, 
          conflictingTime: pending.hora,
          pendingId: pending.id
        });
        
        return new Response(
          JSON.stringify({ 
            valid: false, 
            message: 'Horário temporariamente reservado. Tente outro horário ou aguarde alguns minutos.' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    }

    // No conflicts found
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
