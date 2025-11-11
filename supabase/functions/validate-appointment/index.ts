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

    // Parse the time to get start time in minutes
    const [startHour, startMinute] = hora.split(':').map(Number);
    const startTimeInMinutes = startHour * 60 + startMinute;
    const endTimeInMinutes = startTimeInMinutes + duracao + 10; // 10-minute buffer

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
