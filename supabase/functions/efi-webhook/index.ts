// Edge Function: efi-webhook
// Recebe notificações da Efí Bank quando uma cobrança PIX é paga.
// Atualiza efi_pix_charges.status='PAID' e cria o agendamento confirmado a partir do pending_booking.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Endpoint de validação Efí (HEAD/GET)
  if (req.method !== "POST") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const payload = await req.json();
    const pixList = payload?.pix ?? [];

    for (const pix of pixList) {
      const txid = pix.txid;
      const e2eId = pix.endToEndId;
      if (!txid) continue;

      // Buscar cobrança pendente
      const { data: charge } = await admin
        .from("efi_pix_charges")
        .select("*")
        .eq("txid", txid)
        .maybeSingle();

      if (!charge || charge.status === "PAID") continue;

      // Marcar como paga
      await admin
        .from("efi_pix_charges")
        .update({
          status: "PAID",
          paid_at: new Date().toISOString(),
          e2e_id: e2eId,
          raw_charge: { ...(charge.raw_charge ?? {}), webhook: pix },
        })
        .eq("txid", txid);

      // Confirmar agendamento a partir do pending_booking
      if (charge.pending_booking_id) {
        const { data: pb } = await admin
          .from("pending_bookings")
          .select("*")
          .eq("id", charge.pending_booking_id)
          .maybeSingle();

        if (pb) {
          await admin.from("agendamentos").insert({
            user_id: pb.user_id,
            barbeiro_id: pb.barbeiro_id,
            servico_id: pb.servico_id,
            data: pb.data,
            hora: pb.hora,
            duracao: pb.duracao,
            preco: pb.preco,
            payment_method: "pix",
            status: "confirmed",
            barbeiro_confirmou: true,
            cliente_confirmou: true,
            tipo_agendamento: "regular",
            criado_por: pb.user_id,
          });
          await admin.from("pending_bookings").delete().eq("id", pb.id);
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("efi-webhook error:", e);
    return new Response(JSON.stringify({ error: e?.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
