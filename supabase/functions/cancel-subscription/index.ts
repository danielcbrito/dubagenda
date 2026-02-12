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

    // Buscar assinatura ativa ou suspensa
    const { data: subscription, error: subError } = await supabase
      .from("assinaturas")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["active", "suspended"])
      .maybeSingle();

    if (subError) throw new Error("Erro ao buscar assinatura");
    if (!subscription) throw new Error("Nenhuma assinatura encontrada para cancelar");

    // Cancelar no Stripe se tiver gateway_subscription_id
    if (subscription.gateway_subscription_id) {
      try {
        const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
          apiVersion: "2025-08-27.basil",
        });

        await stripe.subscriptions.cancel(subscription.gateway_subscription_id);
        console.log("[cancel-subscription] Stripe subscription cancelled:", subscription.gateway_subscription_id);
      } catch (stripeError) {
        console.error("[cancel-subscription] Stripe cancellation error:", stripeError);
        // Continuar mesmo se falhar no Stripe
      }
    }

    // Para suspended (nunca ativas), deletar; para active, marcar cancelled
    if (subscription.status === "suspended") {
      await supabase.from("assinaturas").delete().eq("id", subscription.id);
      console.log("[cancel-subscription] Suspended subscription deleted");
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
