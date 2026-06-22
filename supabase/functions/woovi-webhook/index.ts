// Edge Function: woovi-webhook
// Recebe notificações da Woovi (Pix pago) e atualiza o status em woovi_charges,
// confirmando o pending_booking correspondente como agendamento real.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const payload = await req.json().catch(() => ({}));
    console.log("woovi-webhook payload:", JSON.stringify(payload));

    // Woovi envia o evento com payload contendo `event` e `charge`/`pix`
    const charge = payload.charge ?? payload.pix?.charge ?? payload;
    const correlationID: string | undefined = charge?.correlationID;
    const status: string | undefined = charge?.status;

    if (!correlationID) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isPaid =
      payload.event === "OPENPIX:CHARGE_COMPLETED" ||
      payload.event === "OPENPIX:TRANSACTION_RECEIVED" ||
      status === "COMPLETED" ||
      status === "ACTIVE_PAID";

    if (!isPaid) {
      return new Response(JSON.stringify({ ok: true, status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Buscar cobrança local
    const { data: localCharge } = await admin
      .from("woovi_charges")
      .select("*")
      .eq("correlation_id", correlationID)
      .maybeSingle();

    if (!localCharge) {
      return new Response(JSON.stringify({ ok: true, missing: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Buscar pending_booking pelo correlation (prefix book-<id>)
    const pbId = correlationID.startsWith("book-")
      ? correlationID.slice(5)
      : null;

    let agendamentoId: string | null = localCharge.agendamento_id ?? null;

    if (pbId && !agendamentoId) {
      const { data: pb } = await admin
        .from("pending_bookings")
        .select("*")
        .eq("id", pbId)
        .maybeSingle();

      if (pb) {
        const { data: appt, error: apptErr } = await admin
          .from("agendamentos")
          .insert({
            user_id: pb.user_id,
            barbeiro_id: pb.barbeiro_id,
            servico_id: pb.servico_id,
            data: pb.data,
            hora: pb.hora,
            duracao: pb.duracao,
            preco: pb.preco,
            metodo_pagamento: "pix",
            status: "confirmed",
            pago: true,
          })
          .select("id")
          .single();

        if (!apptErr && appt) {
          agendamentoId = appt.id;
          await admin.from("pending_bookings").delete().eq("id", pb.id);
        } else {
          console.error("Erro ao criar agendamento:", apptErr);
        }
      }
    }

    // 3. Atualizar cobrança
    await admin
      .from("woovi_charges")
      .update({
        status: "PAID",
        paid_at: new Date().toISOString(),
        agendamento_id: agendamentoId,
        raw_response: payload,
      })
      .eq("correlation_id", correlationID);

    return new Response(JSON.stringify({ ok: true, agendamentoId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("woovi-webhook error:", e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
