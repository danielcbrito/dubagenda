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

    // 1. Processar lembretes de 3 horas antes (Push + WhatsApp Evolution API)
    try {
      const { data: res3h, error: err3h } = await supabase.rpc("processar_lembretes_3h_antes");
      if (err3h) {
        console.warn("[appointment-reminders] Aviso ao rodar processar_lembretes_3h_antes:", err3h);
      } else {
        console.log("[appointment-reminders] Resultado lembretes 3h:", res3h);
      }
    } catch (e3h) {
      console.warn("[appointment-reminders] Erro ao chamar processar_lembretes_3h_antes:", e3h);
    }

    // 2. Buscar agendamentos que acontecem daqui a ~1 hora (janela de 50-70 min)
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    const windowStart = new Date(now.getTime() + 50 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 70 * 60 * 1000);

    // Horários dos agendamentos estão em horário de Brasília (UTC-3)
    const todayStr = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString().split("T")[0];

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
      const aptTime = new Date(`${apt.data}T${String(apt.hora).slice(0, 5)}:00-03:00`);

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
          titulo: "Seu horário é em breve",
          mensagem: `${serviceName}${barberName ? ` com ${barberName}` : ""} às ${apt.hora}. Vai comparecer? Caso precise, remarque ou cancele pelo app.`,
          agendamento_id: apt.id,
          lida: false,
        });

      if (!notifError) {
        sentCount++;
        // Lembrete por WhatsApp (via n8n)
        const hora = String(apt.hora).slice(0, 5);
        const msg = `Olá! Lembrete: seu horário de ${serviceName}${barberName ? ` com ${barberName}` : ""} é hoje às ${hora}. Te esperamos!`;
        const { error: waError } = await supabase.rpc("send_agendamento_whatsapp_webhook", {
          p_agendamento_id: apt.id,
          p_kind: "lembrete_1h",
          p_msg: msg,
        });
        if (waError) console.error(`WhatsApp reminder error for ${apt.id}:`, waError);
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
