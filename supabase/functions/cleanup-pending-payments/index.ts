import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASAAS_BASE_URL = "https://api.asaas.com/v3";

/**
 * Edge Function: Cleanup de cobranças pendentes.
 * 
 * Ações suportadas:
 * - "cancel": Cancela cobrança específica no Asaas + remove registro do banco (chamada pelo usuário)
 * - "auto_cleanup": Remove cobranças/assinaturas pendentes com mais de 24h (chamada pelo cron)
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    if (!asaasApiKey) throw new Error("ASAAS_API_KEY não configurada");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const asaasHeaders = {
      "Content-Type": "application/json",
      access_token: asaasApiKey,
    };

    const body = await req.json();
    const { action } = body;

    // ═══════════════════════════════════════
    // AÇÃO: Cancelamento manual pelo usuário
    // ═══════════════════════════════════════
    if (action === "cancel") {
      const { asaasPaymentId, pendingBookingId, subscriptionId, type } = body;
      let cancelled = 0;

      // Cancelar/deletar cobrança no Asaas
      if (asaasPaymentId) {
        try {
          const deleteRes = await fetch(`${ASAAS_BASE_URL}/payments/${asaasPaymentId}`, {
            method: "DELETE",
            headers: asaasHeaders,
          });
          
          if (deleteRes.ok || deleteRes.status === 404) {
            console.log(`[cleanup] Asaas payment ${asaasPaymentId} deleted`);
            cancelled++;
          } else {
            const errData = await deleteRes.json();
            console.error(`[cleanup] Failed to delete Asaas payment:`, errData);
          }
        } catch (err) {
          console.error(`[cleanup] Error deleting Asaas payment:`, err);
        }
      }

      // Limpar registro local
      if (type === "booking" && pendingBookingId) {
        await supabaseAdmin.from("pending_bookings").delete().eq("id", pendingBookingId);
        console.log(`[cleanup] Pending booking ${pendingBookingId} deleted`);
        cancelled++;
      }

      if (type === "subscription" && subscriptionId) {
        // Buscar assinatura para pegar gateway_subscription_id e cancelar no Asaas também
        const { data: sub } = await supabaseAdmin
          .from("assinaturas")
          .select("gateway_subscription_id")
          .eq("id", subscriptionId)
          .maybeSingle();

        if (sub?.gateway_subscription_id) {
          try {
            await fetch(`${ASAAS_BASE_URL}/subscriptions/${sub.gateway_subscription_id}`, {
              method: "DELETE",
              headers: asaasHeaders,
            });
            console.log(`[cleanup] Asaas subscription ${sub.gateway_subscription_id} deleted`);
          } catch (err) {
            console.error(`[cleanup] Error deleting Asaas subscription:`, err);
          }
        }

        await supabaseAdmin.from("assinaturas").delete().eq("id", subscriptionId).eq("status", "suspended");
        console.log(`[cleanup] Suspended subscription ${subscriptionId} deleted`);
        cancelled++;
      }

      return new Response(
        JSON.stringify({ success: true, cancelled }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ═══════════════════════════════════════
    // AÇÃO: Limpeza automática (cron - 24h)
    // ═══════════════════════════════════════
    if (action === "auto_cleanup") {
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - 24);
      const cutoffISO = cutoff.toISOString();
      let totalCleaned = 0;

      // 1. Limpar pending_bookings expirados há mais de 24h
      const { data: expiredBookings } = await supabaseAdmin
        .from("pending_bookings")
        .select("id, asaas_payment_id")
        .lt("expires_at", cutoffISO);

      for (const pb of expiredBookings || []) {
        // Cancelar cobrança no Asaas
        if (pb.asaas_payment_id) {
          try {
            await fetch(`${ASAAS_BASE_URL}/payments/${pb.asaas_payment_id}`, {
              method: "DELETE",
              headers: asaasHeaders,
            });
            console.log(`[auto_cleanup] Asaas payment ${pb.asaas_payment_id} deleted`);
          } catch (err) {
            console.error(`[auto_cleanup] Error deleting payment ${pb.asaas_payment_id}:`, err);
          }
        }
        // Deletar do banco
        await supabaseAdmin.from("pending_bookings").delete().eq("id", pb.id);
        totalCleaned++;
      }

      // 2. Limpar assinaturas "suspended" com mais de 24h (nunca foram ativadas)
      const { data: staleSubs } = await supabaseAdmin
        .from("assinaturas")
        .select("id, asaas_payment_id, gateway_subscription_id")
        .eq("status", "suspended")
        .lt("created_at", cutoffISO);

      for (const sub of staleSubs || []) {
        // Cancelar cobrança individual no Asaas
        if (sub.asaas_payment_id) {
          try {
            await fetch(`${ASAAS_BASE_URL}/payments/${sub.asaas_payment_id}`, {
              method: "DELETE",
              headers: asaasHeaders,
            });
            console.log(`[auto_cleanup] Asaas payment ${sub.asaas_payment_id} deleted`);
          } catch (err) {
            console.error(`[auto_cleanup] Error:`, err);
          }
        }
        // Cancelar assinatura recorrente no Asaas
        if (sub.gateway_subscription_id) {
          try {
            await fetch(`${ASAAS_BASE_URL}/subscriptions/${sub.gateway_subscription_id}`, {
              method: "DELETE",
              headers: asaasHeaders,
            });
            console.log(`[auto_cleanup] Asaas subscription ${sub.gateway_subscription_id} deleted`);
          } catch (err) {
            console.error(`[auto_cleanup] Error:`, err);
          }
        }
        // Deletar do banco
        await supabaseAdmin.from("assinaturas").delete().eq("id", sub.id);
        totalCleaned++;
      }

      console.log(`[auto_cleanup] Total cleaned: ${totalCleaned}`);

      return new Response(
        JSON.stringify({ success: true, cleaned: totalCleaned }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Ação inválida. Use 'cancel' ou 'auto_cleanup'.");
  } catch (error: any) {
    console.error("[cleanup-pending-payments] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro desconhecido" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
