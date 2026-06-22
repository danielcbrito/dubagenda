// Edge Function: check-subscription-pix
// Verifica status da cobrança Woovi de uma assinatura pendente.

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
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { subscriptionId } = await req.json();
    if (!subscriptionId) throw new Error("subscriptionId é obrigatório");

    const { data: sub } = await admin
      .from("assinaturas")
      .select("*, plano:planos(preco_mensal)")
      .eq("id", subscriptionId)
      .in("status", ["suspended", "pending_renewal"])
      .maybeSingle();

    if (!sub) {
      return new Response(JSON.stringify({ status: "already_processed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pixExpired = !!sub.pix_expires_at && new Date(sub.pix_expires_at).getTime() <= Date.now();
    const correlationID: string | null = sub.asaas_payment_id ?? null;

    // Consultar cobrança Woovi local
    let chargeStatus: string | null = null;
    if (correlationID) {
      const { data: charge } = await admin
        .from("woovi_charges")
        .select("status")
        .eq("correlation_id", correlationID)
        .maybeSingle();
      chargeStatus = (charge?.status as string | null) ?? null;
    }

    if (chargeStatus === "PAID") {
      if (sub.status === "pending_renewal") {
        const today = new Date();
        const nextBilling = new Date(today);
        nextBilling.setDate(nextBilling.getDate() + 30);
        await admin
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
        await admin
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

      await admin.from("pagamentos").insert({
        user_id: sub.user_id,
        assinatura_id: sub.id,
        metodo: "pix",
        valor: (sub as any).plano?.preco_mensal ?? null,
        gateway_payment_id: correlationID,
        status: "paid",
        data_pagamento: new Date().toISOString(),
      });

      return new Response(JSON.stringify({ status: "paid" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (pixExpired) {
      if (sub.status === "pending_renewal") {
        await admin
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
        await admin.from("assinaturas").delete().eq("id", subscriptionId);
      }
      return new Response(JSON.stringify({ status: "expired" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ status: "pending", wooviStatus: chargeStatus }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[check-subscription-pix] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
