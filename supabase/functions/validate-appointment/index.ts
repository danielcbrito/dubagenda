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
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, hora, duracao, userId }: AppointmentRequest = await req.json();

    // Parse the date and validate it's not Sunday
    const appointmentDate = new Date(data + 'T00:00:00'); // Parse as local date
    if (appointmentDate.getDay() === 0) {
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
    const endTimeInMinutes = startTimeInMinutes + duracao + 10; // 10-minute buffer

    // Block lunch break (13:00-14:00)
    const lunchStart = 13 * 60; // 780 minutes
    const lunchEnd = 14 * 60; // 840 minutes
    
    if (
      (startTimeInMinutes >= lunchStart && startTimeInMinutes < lunchEnd) ||
      (endTimeInMinutes > lunchStart && endTimeInMinutes <= lunchEnd) ||
      (startTimeInMinutes < lunchStart && endTimeInMinutes > lunchEnd)
    ) {
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
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: 'Horário fora do expediente. Funcionamento: Segunda a Sábado, 09:00 às 20:00 (exceto 13:00-14:00).' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Check for conflicts in the database
    const { data: existingAppointments, error } = await supabase
      .from('agendamentos')
      .select('hora, duracao')
      .eq('data', data)
      .in('status', ['pending', 'confirmed']);

    if (error) {
      console.error('Database error:', error);
      return new Response(
        JSON.stringify({ valid: false, message: 'Erro ao verificar disponibilidade' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Check for time conflicts
    for (const apt of existingAppointments || []) {
      const [aptHour, aptMinute] = apt.hora.split(':').map(Number);
      const aptStart = aptHour * 60 + aptMinute;
      const aptEnd = aptStart + apt.duracao + 10; // Include buffer

      // Check for overlap
      const hasConflict = 
        (startTimeInMinutes >= aptStart && startTimeInMinutes < aptEnd) ||
        (endTimeInMinutes > aptStart && endTimeInMinutes <= aptEnd) ||
        (startTimeInMinutes <= aptStart && endTimeInMinutes >= aptEnd);

      if (hasConflict) {
        console.log('Conflict detected:', { 
          requestedTime: hora, 
          conflictingTime: apt.hora,
          requestedDuration: duracao,
          conflictingDuration: apt.duracao
        });
        
        return new Response(
          JSON.stringify({ 
            valid: false, 
            message: 'Horário indisponível. Escolha outro horário disponível.' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    }

    // No conflicts found
    return new Response(
      JSON.stringify({ valid: true, message: 'Horário disponível' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ valid: false, message: 'Erro interno do servidor' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
