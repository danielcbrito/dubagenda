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
      const paymentRes = await fetch(`https://api.asaas.com/v3/payments/${pb.asaas_payment_id}`, {
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

      // === Verificar se é pagamento de ASSINATURA ===
      if (externalReference && typeof externalReference === "string" && externalReference.startsWith("sub_")) {
        console.log("[asaas-webhook] Subscription payment detected, ref:", externalReference);

        // Buscar assinatura pendente pelo asaas_payment_id
        const { data: pendingSub } = await supabase
          .from("assinaturas")
          .select("*")
          .eq("asaas_payment_id", asaasPaymentId)
          .eq("status", "suspended")
          .maybeSingle();

        if (pendingSub) {
          // Ativar a assinatura
          const nextBilling = new Date();
          nextBilling.setMonth(nextBilling.getMonth() + 1);

          await supabase
            .from("assinaturas")
            .update({
              status: "active",
              next_billing_date: nextBilling.toISOString().split("T")[0],
              updated_at: new Date().toISOString(),
            })
            .eq("id", pendingSub.id);

          // Registrar pagamento
          await supabase.from("pagamentos").insert({
            user_id: pendingSub.user_id,
            assinatura_id: pendingSub.id,
            metodo: pendingSub.payment_method || "credit_card",
            valor: payment.value || 0,
            gateway_payment_id: asaasPaymentId,
            status: "paid",
            data_pagamento: new Date().toISOString(),
          });

          console.log("[asaas-webhook] Subscription activated:", pendingSub.id);
          return new Response(
            JSON.stringify({ received: true, message: "Subscription activated" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Pode ser renovação mensal de assinatura ativa
        const { data: activeSub } = await supabase
          .from("assinaturas")
          .select("*")
          .eq("status", "active")
          .or(`gateway_subscription_id.eq.${payment.subscription || ""},asaas_payment_id.eq.${asaasPaymentId}`)
          .maybeSingle();

        if (activeSub) {
          const nextBilling = new Date();
          nextBilling.setMonth(nextBilling.getMonth() + 1);

          await supabase
            .from("assinaturas")
            .update({
              next_billing_date: nextBilling.toISOString().split("T")[0],
              updated_at: new Date().toISOString(),
            })
            .eq("id", activeSub.id);

          await supabase.from("pagamentos").insert({
            user_id: activeSub.user_id,
            assinatura_id: activeSub.id,
            metodo: activeSub.payment_method || "credit_card",
            valor: payment.value || 0,
            gateway_payment_id: asaasPaymentId,
            status: "paid",
            data_pagamento: new Date().toISOString(),
          });

          console.log("[asaas-webhook] Subscription renewal processed:", activeSub.id);
          return new Response(
            JSON.stringify({ received: true, message: "Subscription renewal processed" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log("[asaas-webhook] No matching subscription found for ref:", externalReference);
        return new Response(
          JSON.stringify({ received: true, message: "Subscription not found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // === Pagamento de AGENDAMENTO (booking) ===
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

    // Processar falha de pagamento de assinatura
    if (event === "PAYMENT_OVERDUE" || event === "PAYMENT_DELETED" || event === "PAYMENT_REFUNDED") {
      const externalReference = payment.externalReference;
      if (externalReference && typeof externalReference === "string" && externalReference.startsWith("sub_")) {
        console.log("[asaas-webhook] Subscription payment failed, ref:", externalReference);

        // Buscar assinatura pelo gateway_subscription_id ou asaas_payment_id
        const { data: sub } = await supabase
          .from("assinaturas")
          .select("*")
          .eq("asaas_payment_id", payment.id)
          .maybeSingle();

        if (sub && sub.status === "active") {
          await supabase
            .from("assinaturas")
            .update({ status: "suspended", updated_at: new Date().toISOString() })
            .eq("id", sub.id);
          console.log("[asaas-webhook] Subscription suspended due to payment failure:", sub.id);
        }
      }
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

  // ═══ IDEMPOTÊNCIA: Verificar se já existe agendamento para este pagamento ═══
  if (gatewayPaymentId) {
    const { data: existingPayment } = await supabase
      .from("pagamentos")
      .select("agendamento_id")
      .eq("gateway_payment_id", gatewayPaymentId)
      .maybeSingle();

    if (existingPayment?.agendamento_id) {
      console.log("[asaas-webhook] Payment already processed, skipping. Existing appointment:", existingPayment.agendamento_id);
      // Limpar pending_booking caso ainda exista
      await supabase.from("pending_bookings").delete().eq("id", pb.id);
      return existingPayment.agendamento_id;
    }
  }

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
      payment_method: pb.payment_method || "pix",
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
