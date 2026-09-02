import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Resolve a API key e URL base do Asaas para o barbeiro da assinatura.
 */
async function resolveAsaasConfig(
  supabase: any,
  barbeiroId: string | null,
  fallbackKey: string
): Promise<{ apiKey: string; baseUrl: string }> {
  let apiKey = fallbackKey;

  if (barbeiroId) {
    const { data: barberPrivate } = await supabase
      .from("barbeiros_private")
      .select("asaas_api_key")
      .eq("barbeiro_id", barbeiroId)
      .maybeSingle();

    if (barberPrivate?.asaas_api_key) {
      console.log("[cancel-subscription] Usando sub-conta do barbeiro:", barbeiroId);
      apiKey = barberPrivate.asaas_api_key;
    }
  }

  const isSandbox = apiKey.includes("hmlg");
  const baseUrl = isSandbox ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3";
  if (isSandbox) console.log("[cancel-subscription] 🧪 Modo SANDBOX detectado");

  return { apiKey, baseUrl };
}

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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Não autorizado");

    // Buscar assinatura ativa ou suspensa
    const { data: subscription, error: subError } = await supabase
      .from("assinaturas")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["active", "suspended", "pending_cash"])
      .maybeSingle();

    if (subError) throw new Error("Erro ao buscar assinatura");
    if (!subscription) throw new Error("Nenhuma assinatura encontrada para cancelar");

    // Resolver API key do barbeiro vinculado à assinatura
    const { apiKey: asaasApiKey, baseUrl: ASAAS_BASE_URL } = await resolveAsaasConfig(
      supabase,
      subscription.barbeiro_id,
      globalAsaasKey
    );

    // Cancelar assinatura recorrente no Asaas
    if (subscription.gateway_subscription_id) {
      try {
        const cancelRes = await fetch(
          `${ASAAS_BASE_URL}/subscriptions/${subscription.gateway_subscription_id}`,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              access_token: asaasApiKey,
            },
          }
        );

        const cancelData = await cancelRes.json();
        console.log("[cancel-subscription] Asaas response:", JSON.stringify(cancelData));

        if (!cancelRes.ok && cancelRes.status !== 404) {
          console.error("[cancel-subscription] Asaas cancellation failed:", cancelData);
        } else {
          console.log("[cancel-subscription] Asaas subscription cancelled:", subscription.gateway_subscription_id);
        }
      } catch (asaasError) {
        console.error("[cancel-subscription] Asaas cancellation error:", asaasError);
      }
    }

    // Para suspended (nunca ativas), deletar; para active, marcar cancelled
    if (subscription.status === "suspended" || subscription.status === "pending_cash") {
      await supabase.from("assinaturas").delete().eq("id", subscription.id);
      console.log("[cancel-subscription] Pending subscription deleted");
    } else {
      await supabase
        .from("assinaturas")
        .update({ status: "cancelled" })
        .eq("id", subscription.id);
      console.log("[cancel-subscription] Active subscription cancelled");
    }

    return new Response(
      JSON.stringify({ success: true, message: "Assinatura cancelada com sucesso" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[cancel-subscription] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro ao cancelar assinatura" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
