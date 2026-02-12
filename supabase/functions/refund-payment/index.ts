import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Edge Function: refund-payment
 * Realiza estorno automático de pagamentos via Stripe.
 * Fallback: crédito interno se o Stripe recusar.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Token inválido" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const { agendamento_id } = await req.json();
    if (!agendamento_id) {
      return new Response(
        JSON.stringify({ success: false, error: "agendamento_id é obrigatório" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log(`[refund-payment] Iniciando estorno: ${agendamento_id}`);

    // Buscar pagamento pago associado
    const { data: pagamento, error: pagError } = await supabase
      .from("pagamentos")
      .select("id, gateway_payment_id, status, metodo, valor")
      .eq("agendamento_id", agendamento_id)
      .eq("status", "paid")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pagError) throw new Error("Erro ao buscar pagamento");

    if (!pagamento || !pagamento.gateway_payment_id) {
      return new Response(
        JSON.stringify({ success: true, refunded: false, message: "Nenhum pagamento encontrado para estorno" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[refund-payment] Pagamento: ${pagamento.gateway_payment_id} | Valor: R$ ${pagamento.valor}`);

    // Tentar estorno via Stripe
    try {
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2025-08-27.basil",
      });

      await stripe.refunds.create({
        payment_intent: pagamento.gateway_payment_id,
      });

      // Atualizar status
      await supabase
        .from("pagamentos")
        .update({ status: "refunded" })
        .eq("id", pagamento.id);

      console.log("[refund-payment] Estorno Stripe realizado com sucesso");

      return new Response(
        JSON.stringify({
          success: true,
          refunded: true,
          refund_type: "gateway",
          message: `Estorno de R$ ${pagamento.valor.toFixed(2)} realizado com sucesso.`,
          valor: pagamento.valor,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (stripeError) {
      console.error("[refund-payment] Stripe refund failed:", stripeError);

      // Fallback: crédito interno
      await supabase.from("creditos").insert({
        user_id: user.id,
        valor: pagamento.valor,
        origem: "estorno_cancelamento",
        agendamento_origem_id: agendamento_id,
        usado: false,
      });

      return new Response(
        JSON.stringify({
          success: true,
          refunded: true,
          refund_type: "credit",
          message: `Estorno via gateway falhou. R$ ${pagamento.valor.toFixed(2)} adicionado como crédito.`,
          valor: pagamento.valor,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("[refund-payment] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
