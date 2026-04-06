import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// URL base é resolvida dinamicamente

/**
 * Resolve a API key do Asaas para o barbeiro vinculado à assinatura.
 * Se o barbeiro tiver sub-conta, usa ela. Senão, usa a chave principal.
 */
async function resolveAsaasConfig(
  supabaseAdmin: any,
  barbeiroId: string | null,
  fallbackKey: string
): Promise<{ apiKey: string; baseUrl: string }> {
  let apiKey = fallbackKey;

  if (barbeiroId) {
    const { data: barberPrivate } = await supabaseAdmin
      .from("barbeiros_private")
      .select("asaas_api_key")
      .eq("barbeiro_id", barbeiroId)
      .maybeSingle();

    if (barberPrivate?.asaas_api_key) {
      console.log("[check-subscription-pix] Usando sub-conta do barbeiro:", barbeiroId);
      apiKey = barberPrivate.asaas_api_key;
    }
  }

  const isSandbox = apiKey.includes("hmlg");
  const baseUrl = isSandbox ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3";
  if (isSandbox) console.log("[check-subscription-pix] 🧪 Modo SANDBOX detectado");

  return { apiKey, baseUrl };
}

/**
 * Verifica status do pagamento PIX de uma assinatura pendente.
 * Usa a sub-conta do barbeiro quando disponível.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const globalAsaasKey = Deno.env.get("ASAAS_API_KEY");
    if (!globalAsaasKey) throw new Error("ASAAS_API_KEY não configurada");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { subscriptionId } = body;
    if (!subscriptionId) throw new Error("subscriptionId é obrigatório");

    // Buscar assinatura (inclui pending_renewal para reconciliar renovação PIX)
    const { data: sub } = await supabase
      .from("assinaturas")
      .select("*")
      .eq("id", subscriptionId)
      .in("status", ["suspended", "pending_renewal"])
      .maybeSingle();

    if (!sub) {
      return new Response(
        JSON.stringify({ status: "already_processed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pixExpired = !!sub.pix_expires_at && new Date(sub.pix_expires_at).getTime() <= Date.now();

    if (sub.status === "pending_renewal" && pixExpired) {
      await supabase
        .from("assinaturas")
        .update({
          status: "active",
          asaas_payment_id: null,
          pix_qr_code: null,
          pix_payload: null,
          pix_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscriptionId);

      return new Response(
        JSON.stringify({ status: "expired", revertedTo: "active" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!sub.asaas_payment_id) {
      return new Response(
        JSON.stringify({ status: "pending", message: "Sem pagamento Asaas vinculado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolver API key + URL do barbeiro vinculado
    const { apiKey: asaasApiKey, baseUrl: ASAAS_BASE_URL } = await resolveAsaasConfig(supabase, sub.barbeiro_id, globalAsaasKey);

    // Consultar status no Asaas
    const paymentRes = await fetch(
      `${ASAAS_BASE_URL}/payments/${sub.asaas_payment_id}`,
      { headers: { access_token: asaasApiKey } }
    );
    const paymentData = await paymentRes.json();

    console.log("[check-subscription-pix] Status:", paymentData.status);

    if (paymentData.status === "RECEIVED" || paymentData.status === "CONFIRMED") {
      if (sub.status === "pending_renewal") {
        const today = new Date();
        const nextBilling = new Date(today);
        nextBilling.setDate(nextBilling.getDate() + 30);

        await supabase
          .from("assinaturas")
          .update({
            status: "active",
            ciclo_inicio: today.toISOString().split("T")[0],
            ciclo_fim: nextBilling.toISOString().split("T")[0],
            next_billing_date: nextBilling.toISOString().split("T")[0],
            usos_ciclo_atual: 0,
            total_renovacoes: (sub.total_renovacoes || 0) + 1,
            renovada_antecipadamente: true,
            cash_payment_confirmed: null,
            asaas_payment_id: null,
            pix_qr_code: null,
            pix_payload: null,
            pix_expires_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", subscriptionId);
      } else {
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
      }

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
      if (sub.status === "pending_renewal") {
        await supabase
          .from("assinaturas")
          .update({
            status: "active",
            asaas_payment_id: null,
            pix_qr_code: null,
            pix_payload: null,
            pix_expires_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", subscriptionId);
      } else {
        await supabase.from("assinaturas").delete().eq("id", subscriptionId);
      }

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