import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Não autorizado");

    const { session_id } = await req.json();
    if (!session_id) throw new Error("session_id é obrigatório");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const session = await stripe.checkout.sessions.retrieve(session_id);
    console.log("[verify-stripe-session] Session:", session.id, "status:", session.payment_status);

    const metadata = session.metadata || {};

    // ========== SUBSCRIPTION VERIFICATION ==========
    if (metadata.type === "subscription") {
      if (session.payment_status !== "paid") {
        return new Response(
          JSON.stringify({ success: false, message: "Pagamento não confirmado" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      const planId = metadata.plan_id;
      const stripeSubscriptionId = session.subscription as string;

      // Limpar assinaturas suspended antigas
      await supabase
        .from("assinaturas")
        .delete()
        .eq("user_id", user.id)
        .eq("status", "suspended");

      // Verificar se já existe assinatura ativa
      const { data: existing } = await supabase
        .from("assinaturas")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ success: true, message: "Assinatura já ativa", already_active: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      // Calcular next_billing_date (30 dias)
      const nextBilling = new Date();
      nextBilling.setDate(nextBilling.getDate() + 30);

      const { error: insertError } = await supabase.from("assinaturas").insert({
        user_id: user.id,
        plano_id: planId,
        status: "active",
        payment_method: "card",
        gateway_subscription_id: stripeSubscriptionId,
        next_billing_date: nextBilling.toISOString().split("T")[0],
      });

      if (insertError) {
        console.error("[verify-stripe-session] Error creating subscription:", insertError);
        throw new Error("Erro ao salvar assinatura");
      }

      // Desbloquear usuário se necessário
      await supabase
        .from("profiles")
        .update({ blocked: false })
        .eq("id", user.id);

      console.log("[verify-stripe-session] Subscription activated for user:", user.id);

      return new Response(
        JSON.stringify({ success: true, type: "subscription", message: "Assinatura ativada com sucesso!" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // ========== BOOKING VERIFICATION ==========
    if (metadata.type === "booking") {
      if (session.payment_status !== "paid") {
        return new Response(
          JSON.stringify({ success: false, message: "Pagamento não confirmado" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      const pendingBookingId = metadata.pending_booking_id;
      const rescheduleFromId = metadata.reschedule_from_id || null;

      // Buscar pending_booking
      const { data: pendingBooking, error: pbError } = await supabase
        .from("pending_bookings")
        .select("*")
        .eq("id", pendingBookingId)
        .maybeSingle();

      if (pbError || !pendingBooking) {
        console.log("[verify-stripe-session] Pending booking not found - may already be converted");
        return new Response(
          JSON.stringify({ success: true, message: "Agendamento já processado", already_processed: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      // Se reagendando, cancelar agendamento antigo
      if (rescheduleFromId) {
        await supabase
          .from("agendamentos")
          .update({ status: "cancelled_by_user", visivel_para_usuario: false })
          .eq("id", rescheduleFromId);
      }

      // Criar agendamento
      const { data: appointment, error: aptError } = await supabase
        .from("agendamentos")
        .insert({
          user_id: pendingBooking.user_id,
          servico_id: pendingBooking.servico_id,
          barbeiro_id: pendingBooking.barbeiro_id,
          data: pendingBooking.data,
          hora: pendingBooking.hora,
          duracao: pendingBooking.duracao,
          preco: pendingBooking.preco,
          observacoes: pendingBooking.observacoes,
          status: "pending",
          barbeiro_confirmou: false,
          cliente_confirmou: true,
          payment_method: pendingBooking.payment_method,
          remarcado_de: rescheduleFromId,
        })
        .select()
        .single();

      if (aptError) {
        console.error("[verify-stripe-session] Error creating appointment:", aptError);
        throw aptError;
      }

      // Registrar pagamento
      const paymentIntentId = session.payment_intent as string;
      await supabase.from("pagamentos").insert({
        user_id: pendingBooking.user_id,
        agendamento_id: appointment.id,
        metodo: pendingBooking.payment_method || "card",
        valor: pendingBooking.preco,
        gateway_payment_id: paymentIntentId,
        status: "paid",
        data_pagamento: new Date().toISOString(),
      });

      // Deletar pending booking
      await supabase.from("pending_bookings").delete().eq("id", pendingBookingId);

      // Google Calendar sync (non-blocking)
      try {
        const { data: servico } = await supabase
          .from("servicos")
          .select("nome")
          .eq("id", pendingBooking.servico_id)
          .single();

        const startDateTime = `${pendingBooking.data}T${pendingBooking.hora}:00`;
        const endDate = new Date(`${pendingBooking.data}T${pendingBooking.hora}`);
        endDate.setMinutes(endDate.getMinutes() + pendingBooking.duracao);

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
            description: `Pagamento via ${pendingBooking.payment_method?.toUpperCase() || "STRIPE"}`,
            startDateTime,
            endDateTime: endDate.toISOString().slice(0, 19),
          }),
        });
      } catch (e) {
        console.error("[verify-stripe-session] Google Calendar error:", e);
      }

      console.log("[verify-stripe-session] Booking verified, appointment created:", appointment.id);

      return new Response(
        JSON.stringify({ success: true, type: "booking", appointmentId: appointment.id, message: "Agendamento confirmado!" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    return new Response(
      JSON.stringify({ success: false, message: "Tipo de sessão desconhecido" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  } catch (error) {
    console.error("[verify-stripe-session] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
