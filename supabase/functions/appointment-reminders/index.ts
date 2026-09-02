import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar agendamentos que acontecem daqui a ~1 hora (janela de 50-70 min)
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    const windowStart = new Date(now.getTime() + 50 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 70 * 60 * 1000);

    const todayStr = now.toISOString().split("T")[0];

    // Buscar agendamentos de hoje com status pendente ou confirmado
    const { data: appointments, error: aptError } = await supabase
      .from("agendamentos")
      .select("id, user_id, data, hora, servico_id, servico:servicos(nome), barbeiro:barbeiros(apelido)")
      .eq("data", todayStr)
      .in("status", ["pending", "confirmed"])
      .eq("visivel_para_usuario", true);

    if (aptError) {
      console.error("Error fetching appointments:", aptError);
      return new Response(JSON.stringify({ error: aptError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!appointments || appointments.length === 0) {
      return new Response(
        JSON.stringify({ message: "No appointments to remind", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let sentCount = 0;

    for (const apt of appointments) {
      // Calcular horário do agendamento
      const [h, m] = apt.hora.split(":").map(Number);
      const aptTime = new Date(now);
      aptTime.setHours(h, m, 0, 0);

      // Verificar se está dentro da janela de 1 hora
      if (aptTime < windowStart || aptTime > windowEnd) continue;

      // Verificar se já enviou lembrete para este agendamento
      const { data: existing } = await supabase
        .from("notificacoes")
        .select("id")
        .eq("user_id", apt.user_id)
        .eq("agendamento_id", apt.id)
        .eq("tipo", "lembrete")
        .limit(1);

      if (existing && existing.length > 0) continue;

      // Criar notificação de lembrete
      const serviceName = (apt.servico as any)?.nome || "Serviço";
      const barberName = (apt.barbeiro as any)?.apelido || "";

      const { error: notifError } = await supabase
        .from("notificacoes")
        .insert({
          user_id: apt.user_id,
          tipo: "lembrete",
          titulo: "⏰ Seu horário é em breve!",
          mensagem: `${serviceName}${barberName ? ` com ${barberName}` : ""} às ${apt.hora}. Vai comparecer? Caso precise, remarque ou cancele pelo app.`,
          agendamento_id: apt.id,
          lida: false,
        });

      if (!notifError) {
        sentCount++;
        console.log(`Reminder sent for appointment ${apt.id}`);
      } else {
        console.error(`Error sending reminder for ${apt.id}:`, notifError);
      }
    }

    return new Response(
      JSON.stringify({ message: "Reminders processed", sent: sentCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in appointment-reminders:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
