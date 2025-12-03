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
  excludeAppointmentId?: string; // Para reagendamentos - excluir o agendamento atual
}

/**
 * Edge Function para validação ATÔMICA de disponibilidade de horário.
 * 
 * Esta função é CRÍTICA para evitar agendamentos duplicados.
 * Ela verifica:
 * 1. Horário de funcionamento (09:00-20:00)
 * 2. Horário de almoço (13:00-14:00)
 * 3. Dias de funcionamento (segunda a sábado)
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

    const { data, hora, duracao, userId, excludeAppointmentId }: AppointmentRequest = await req.json();
    
    console.log('[validate-appointment] Iniciando validação:', { data, hora, duracao, userId, excludeAppointmentId });

    // Parse the date and validate it's not Sunday
    const appointmentDate = new Date(data + 'T00:00:00'); // Parse as local date
    if (appointmentDate.getDay() === 0) {
      console.log('[validate-appointment] Rejeitado: Domingo');
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: 'A barbearia não funciona aos domingos.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Parse the time to get start time in minutes
    const [startHour, startMinute] = hora.split(':').map(Number);
    const startTimeInMinutes = startHour * 60 + startMinute;
    const endTimeInMinutes = startTimeInMinutes + duracao;
    // REMOVIDO buffer de 10 minutos - deve usar duração EXATA para consistência com front-end

    // Block lunch break (13:00-14:00)
    const lunchStart = 13 * 60; // 780 minutes
    const lunchEnd = 14 * 60; // 840 minutes
    
    if (
      (startTimeInMinutes >= lunchStart && startTimeInMinutes < lunchEnd) ||
      (endTimeInMinutes > lunchStart && endTimeInMinutes <= lunchEnd) ||
      (startTimeInMinutes < lunchStart && endTimeInMinutes > lunchEnd)
    ) {
      console.log('[validate-appointment] Rejeitado: Horário de almoço');
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: 'Horário indisponível. A barbearia está fechada para almoço entre 13:00 e 14:00.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Validate business hours (09:00 - 20:00, Monday-Saturday)
    const openHour = 9 * 60; // 540 minutes (09:00)
    const closeHour = 20 * 60; // 1200 minutes (20:00)
    
    if (startTimeInMinutes < openHour || endTimeInMinutes > closeHour) {
      console.log('[validate-appointment] Rejeitado: Fora do expediente');
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: 'Horário fora do expediente. Funcionamento: Segunda a Sábado, 09:00 às 20:00 (exceto 13:00-14:00).' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // ============================================
    // VERIFICAÇÃO CRÍTICA: Conflitos de agendamentos
    // ============================================
    
    // Build query to check for conflicts in agendamentos
    let agendamentosQuery = supabase
      .from('agendamentos')
      .select('id, hora, duracao, status')
      .eq('data', data)
      .in('status', ['pending', 'confirmed']);
    
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
    for (const apt of existingAppointments || []) {
      const [aptHour, aptMinute] = apt.hora.split(':').map(Number);
      const aptStart = aptHour * 60 + aptMinute;
      const aptEnd = aptStart + apt.duracao; // Duração EXATA sem buffer

      // Check for overlap: dois intervalos se sobrepõem quando início1 < fim2 E fim1 > início2
      const hasConflict = startTimeInMinutes < aptEnd && endTimeInMinutes > aptStart;

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
    const { data: pendingBookings, error: pendingError } = await supabase
      .from('pending_bookings')
      .select('id, hora, duracao, expires_at')
      .eq('data', data)
      .gt('expires_at', new Date().toISOString()); // Apenas reservas não expiradas

    if (pendingError) {
      console.error('[validate-appointment] Erro ao buscar pending_bookings:', pendingError);
      // Continue mesmo com erro - não bloquear por causa de pending_bookings
    }

    // Check for conflicts with pending bookings
    for (const pending of pendingBookings || []) {
      const [pendingHour, pendingMinute] = pending.hora.split(':').map(Number);
      const pendingStart = pendingHour * 60 + pendingMinute;
      const pendingEnd = pendingStart + pending.duracao; // Duração EXATA

      // Overlap: início1 < fim2 E fim1 > início2
      const hasConflict = startTimeInMinutes < pendingEnd && endTimeInMinutes > pendingStart;

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
