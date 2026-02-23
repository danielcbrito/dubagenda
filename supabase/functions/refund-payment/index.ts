import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Edge Function: refund-payment
 * Quando um agendamento pago é cancelado, o valor vai direto para o saldo da carteira (wallet_balances).
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

    console.log(`[refund-payment] Iniciando estorno para carteira: ${agendamento_id}`);

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

    if (!pagamento) {
      return new Response(
        JSON.stringify({ success: true, refunded: false, message: "Nenhum pagamento encontrado para estorno" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const valor = pagamento.valor;
    console.log(`[refund-payment] Pagamento encontrado: R$ ${valor} | Método: ${pagamento.metodo}`);

    // Creditar direto no saldo da carteira
    const { data: currentBalance } = await supabase
      .rpc("get_or_create_wallet_balance", { p_user_id: user.id });

    const newBalance = (currentBalance || 0) + valor;

    const { error: updateError } = await supabase
      .from("wallet_balances")
      .update({ balance: newBalance })
      .eq("user_id", user.id);

    if (updateError) {
      console.error("[refund-payment] Erro ao atualizar saldo:", updateError);
      throw new Error("Erro ao creditar carteira");
    }

    // Registrar transação
    await supabase.from("wallet_transactions").insert({
      user_id: user.id,
      type: "refund",
      amount: valor,
      status: "completed",
      description: `Estorno de cancelamento (${pagamento.metodo === 'pix' ? 'PIX' : pagamento.metodo === 'card' ? 'Cartão' : pagamento.metodo}) - R$ ${valor.toFixed(2)}`,
    });

    // Marcar pagamento como estornado
    await supabase
      .from("pagamentos")
      .update({ status: "refunded" })
      .eq("id", pagamento.id);

    console.log(`[refund-payment] R$ ${valor.toFixed(2)} creditado na carteira do usuário ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        refunded: true,
        refund_type: "wallet",
        message: `R$ ${valor.toFixed(2)} adicionado ao saldo da sua carteira.`,
        valor,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[refund-payment] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
