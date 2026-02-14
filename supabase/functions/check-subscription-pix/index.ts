import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { format } from "https://deno.land/x/date_fns@v2.22.1/format/index.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASAAS_BASE_URL = "https://sandbox.asaas.com/api/v3";

/**
 * Verifica status do pagamento PIX de uma assinatura pendente.
 * Se pago, ativa a assinatura. Se expirado, limpa.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    if (!asaasApiKey) throw new Error("ASAAS_API_KEY não configurada");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { subscriptionId } = body;
    if (!subscriptionId) throw new Error("subscriptionId é obrigatório");

    // Buscar assinatura
    const { data: sub } = await supabase
      .from("assinaturas")
      .select("*")
      .eq("id", subscriptionId)
      .eq("status", "suspended")
      .maybeSingle();

    if (!sub) {
      return new Response(
        JSON.stringify({ status: "already_processed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!sub.asaas_payment_id) {
      return new Response(
        JSON.stringify({ status: "pending", message: "Sem pagamento Asaas vinculado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Consultar status no Asaas
    const paymentRes = await fetch(
      `${ASAAS_BASE_URL}/payments/${sub.asaas_payment_id}`,
      { headers: { access_token: asaasApiKey } }
    );
    const paymentData = await paymentRes.json();

    console.log("[check-subscription-pix] Status:", paymentData.status);

    if (paymentData.status === "RECEIVED" || paymentData.status === "CONFIRMED") {
      // Ativar assinatura
      const nextBilling = new Date();
      nextBilling.setMonth(nextBilling.getMonth() + 1);

      await supabase
        .from("assinaturas")
        .update({
          status: "active",
          next_billing_date: nextBilling.toISOString().split("T")[0],
          pix_qr_code: null,
          pix_payload: null,
          pix_expires_at: null,
        })
        .eq("id", subscriptionId);

      // Registrar pagamento
      await supabase.from("pagamentos").insert({
        user_id: sub.user_id,
        assinatura_id: sub.id,
        metodo: "pix",
        valor: paymentData.value,
        gateway_payment_id: sub.asaas_payment_id,
        status: "paid",
        data_pagamento: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({ status: "paid" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (
      paymentData.status === "OVERDUE" ||
      paymentData.status === "REFUNDED" ||
      paymentData.status === "DELETED"
    ) {
      // Expirado — deletar assinatura pendente
      await supabase.from("assinaturas").delete().eq("id", subscriptionId);
      return new Response(
        JSON.stringify({ status: "expired" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ status: "pending", asaasStatus: paymentData.status }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[check-subscription-pix] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
