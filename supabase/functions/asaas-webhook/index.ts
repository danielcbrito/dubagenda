import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Webhook do Asaas para processar confirmação de pagamento PIX.
 * Quando o PIX é pago, converte o pending_booking em agendamento.
 *
 * Também suporta chamada manual via POST com { action: "check", asaasPaymentId, pendingBookingId }
 * para verificação sob demanda pelo frontend.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();

    // ========== MANUAL CHECK (frontend polling) ==========
    if (body.action === "check") {
      const { pendingBookingId } = body;
      if (!pendingBookingId) throw new Error("pendingBookingId é obrigatório");

      const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
      if (!asaasApiKey) throw new Error("ASAAS_API_KEY não configurada");

      // Buscar pending_booking
      const { data: pb } = await supabase
        .from("pending_bookings")
        .select("*")
        .eq("id", pendingBookingId)
        .maybeSingle();

      if (!pb) {
        // Já foi processado
        return new Response(
          JSON.stringify({ status: "already_processed" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!pb.asaas_payment_id) {
        return new Response(
          JSON.stringify({ status: "pending", message: "Pagamento ainda não criado no Asaas" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Consultar status no Asaas
      const paymentRes = await fetch(`https://sandbox.asaas.com/api/v3/payments/${pb.asaas_payment_id}`, {
        headers: { access_token: asaasApiKey },
      });
      const paymentData = await paymentRes.json();

      console.log("[asaas-webhook] Check payment status:", paymentData.status);

      if (paymentData.status === "RECEIVED" || paymentData.status === "CONFIRMED") {
        // Pagamento confirmado — converter em agendamento
        const appointmentId = await convertPendingToAppointment(supabase, pb, paymentData.id);
        return new Response(
          JSON.stringify({ status: "paid", appointmentId }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (paymentData.status === "OVERDUE" || paymentData.status === "REFUNDED" || paymentData.status === "DELETED") {
        // Pagamento expirado/cancelado — limpar pending
        await supabase.from("pending_bookings").delete().eq("id", pendingBookingId);
        return new Response(
          JSON.stringify({ status: "expired" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ status: "pending", asaasStatus: paymentData.status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== ASAAS WEBHOOK EVENT ==========
    const event = body.event;
    const payment = body.payment;

    console.log("[asaas-webhook] Event received:", event);

    if (!event || !payment) {
      return new Response(
        JSON.stringify({ received: true, message: "No event/payment data" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Processar apenas confirmação de pagamento
    if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
      const asaasPaymentId = payment.id;
      const externalReference = payment.externalReference;

      console.log("[asaas-webhook] Payment confirmed:", asaasPaymentId, "ref:", externalReference);

      // Buscar pending_booking pelo asaas_payment_id ou externalReference (pendingBookingId)
      let pb: any = null;

      if (asaasPaymentId) {
        const { data } = await supabase
          .from("pending_bookings")
          .select("*")
          .eq("asaas_payment_id", asaasPaymentId)
          .maybeSingle();
        pb = data;
      }

      if (!pb && externalReference) {
        const { data } = await supabase
          .from("pending_bookings")
          .select("*")
          .eq("id", externalReference)
          .maybeSingle();
        pb = data;
      }

      if (!pb) {
        console.log("[asaas-webhook] Pending booking not found — may be already processed");
        return new Response(
          JSON.stringify({ received: true, message: "Already processed or not found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await convertPendingToAppointment(supabase, pb, asaasPaymentId);

      return new Response(
        JSON.stringify({ received: true, message: "Booking confirmed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Outros eventos — apenas confirmar recebimento
    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[asaas-webhook] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

/**
 * Converte um pending_booking em agendamento confirmado.
 */
async function convertPendingToAppointment(
  supabase: any,
  pb: any,
  gatewayPaymentId: string
): Promise<string> {
  console.log("[asaas-webhook] Converting pending_booking:", pb.id);

  // Criar agendamento
  const { data: appointment, error: aptError } = await supabase
    .from("agendamentos")
    .insert({
      user_id: pb.user_id,
      servico_id: pb.servico_id,
      barbeiro_id: pb.barbeiro_id,
      data: pb.data,
      hora: pb.hora,
      duracao: pb.duracao,
      preco: pb.preco,
      observacoes: pb.observacoes,
      status: "pending",
      barbeiro_confirmou: false,
      cliente_confirmou: true,
      payment_method: "pix",
    })
    .select()
    .single();

  if (aptError) {
    console.error("[asaas-webhook] Error creating appointment:", aptError);
    throw aptError;
  }

  // Registrar pagamento
  await supabase.from("pagamentos").insert({
    user_id: pb.user_id,
    agendamento_id: appointment.id,
    metodo: "pix",
    valor: pb.preco,
    gateway_payment_id: gatewayPaymentId,
    status: "paid",
    data_pagamento: new Date().toISOString(),
  });

  // Deletar pending_booking
  await supabase.from("pending_bookings").delete().eq("id", pb.id);

  // Google Calendar sync (non-blocking)
  try {
    const { data: servico } = await supabase
      .from("servicos")
      .select("nome")
      .eq("id", pb.servico_id)
      .single();

    const startDateTime = `${pb.data}T${pb.hora}:00`;
    const endDate = new Date(`${pb.data}T${pb.hora}`);
    endDate.setMinutes(endDate.getMinutes() + pb.duracao);

    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/google-calendar-sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        action: "create",
        appointmentId: appointment.id,
        summary: `Agendamento: ${servico?.nome || "Serviço"}`,
        description: "Pagamento via PIX (Asaas)",
        startDateTime,
        endDateTime: endDate.toISOString().slice(0, 19),
      }),
    });
  } catch (e) {
    console.error("[asaas-webhook] Google Calendar error:", e);
  }

  console.log("[asaas-webhook] Appointment created:", appointment.id);
  return appointment.id;
}
