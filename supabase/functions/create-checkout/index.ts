import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Mapeamento de planos internos (Supabase) para preços do Stripe
 */
const PLAN_PRICE_MAP: Record<string, string> = {
  "b78adffc-da65-4085-8305-0386e1e9d962": "price_1T08CFLN5yQChZnofK09gVvo", // Plano só Barba R$79.99
  "f37ec929-292e-41e9-b0e4-80476983a946": "price_1T08CTLN5yQChZnoKElcmMyj", // Plano Só Corte R$89.99
  "77a1da4d-698b-462b-b864-57bc30985f93": "price_1T08CnLN5yQChZnoWC3gISr1", // Corte + Sobrancelha R$99.90
  "d292ce6c-1d9d-4741-83e2-5ba0540ce805": "price_1T08D9LN5yQChZnoeP4Srz0p", // Plano Corte + Barba R$129.99
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("Usuário não autenticado");

    const { planoId } = await req.json();
    if (!planoId) throw new Error("planoId é obrigatório");

    const stripePriceId = PLAN_PRICE_MAP[planoId];
    if (!stripePriceId) throw new Error("Plano não encontrado no Stripe");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Buscar ou reusar customer do Stripe
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "https://dubagenda.lovable.app";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: stripePriceId, quantity: 1 }],
      mode: "subscription",
      metadata: {
        type: "subscription",
        plan_id: planoId,
        user_id: user.id,
      },
      success_url: `${origin}/cliente?stripe_success=subscription&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cliente/assinar`,
    });

    console.log("[create-checkout] Checkout session created:", session.id);

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("[create-checkout] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
