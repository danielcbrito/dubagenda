import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASAAS_BASE_URL = "https://api.asaas.com/v3";

/**
 * Busca ou cria customer no Asaas
 */
async function getOrCreateAsaasCustomer(
  apiKey: string,
  user: { id: string; email: string; user_metadata?: any }
): Promise<string> {
  const headers = {
    "Content-Type": "application/json",
    access_token: apiKey,
  };

  const searchRes = await fetch(
    `${ASAAS_BASE_URL}/customers?email=${encodeURIComponent(user.email)}`,
    { headers }
  );
  const searchData = await searchRes.json();

  if (searchData.data?.length > 0) {
    return searchData.data[0].id;
  }

  const name =
    user.user_metadata?.nome ||
    user.user_metadata?.full_name ||
    user.email.split("@")[0];
  const cpf = user.user_metadata?.cpf || undefined;

  const createRes = await fetch(`${ASAAS_BASE_URL}/customers`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name,
      email: user.email,
      cpfCnpj: cpf,
      externalReference: user.id,
    }),
  });

  const createData = await createRes.json();
  if (createData.errors) {
    throw new Error("Erro ao criar cliente no Asaas: " + JSON.stringify(createData.errors));
  }

  return createData.id;
}

/**
 * Edge Function: Cria cobrança via Cartão de Crédito no Asaas para assinatura de plano.
 * Retorna a invoiceUrl para redirect do cliente.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    if (!asaasApiKey) throw new Error("ASAAS_API_KEY não configurada");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Autenticar usuário
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("Usuário não autenticado");

    const body = await req.json();
    const { planoId } = body;
    if (!planoId) throw new Error("planoId é obrigatório");

    const origin = req.headers.get("origin") || "https://dubagenda.lovable.app";

    console.log("[create-subscription-card] Iniciando cartão para plano:", planoId);

    // Buscar dados do plano
    const { data: plano, error: planoError } = await supabaseAdmin
      .from("planos")
      .select("id, nome, preco_mensal")
      .eq("id", planoId)
      .eq("ativo", true)
      .single();

    if (planoError || !plano) throw new Error("Plano não encontrado ou inativo");

    // Verificar se já tem assinatura ativa
    const { data: existingSub } = await supabaseAdmin
      .from("assinaturas")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (existingSub) throw new Error("Você já possui uma assinatura ativa");

    // Deletar assinaturas "suspended" anteriores (tentativas não finalizadas)
    await supabaseAdmin
      .from("assinaturas")
      .delete()
      .eq("user_id", user.id)
      .eq("status", "suspended");

    // Buscar/criar customer no Asaas
    const customerId = await getOrCreateAsaasCustomer(asaasApiKey, user);
    console.log("[create-subscription-card] Asaas customer:", customerId);

    // Criar cobrança CREDIT_CARD no Asaas
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    const dueDateStr = dueDate.toISOString().split("T")[0];

    const callbackUrl = `${origin}/cliente?asaas_success=subscription&plan_id=${planoId}`;

    const paymentRes = await fetch(`${ASAAS_BASE_URL}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: asaasApiKey,
      },
      body: JSON.stringify({
        customer: customerId,
        billingType: "CREDIT_CARD",
        value: plano.preco_mensal,
        dueDate: dueDateStr,
        description: `Assinatura: ${plano.nome} (1º mês)`,
        externalReference: `sub_${user.id}_${planoId}`,
        callback: {
          successUrl: callbackUrl,
          autoRedirect: true,
        },
      }),
    });

    const paymentData = await paymentRes.json();
    if (paymentData.errors) {
      console.error("[create-subscription-card] Payment error:", paymentData.errors);
      throw new Error("Erro ao gerar cobrança via cartão: " + JSON.stringify(paymentData.errors));
    }

    console.log("[create-subscription-card] Payment created:", paymentData.id);

    // Criar assinatura com status "suspended" (será ativada pelo webhook)
    const { data: subscription, error: subError } = await supabaseAdmin
      .from("assinaturas")
      .insert({
        user_id: user.id,
        plano_id: planoId,
        status: "suspended",
        payment_method: "credit_card",
        asaas_payment_id: paymentData.id,
      })
      .select()
      .single();

    if (subError) {
      console.error("[create-subscription-card] Subscription insert error:", subError);
      throw new Error("Erro ao criar assinatura pendente");
    }

    return new Response(
      JSON.stringify({
        success: true,
        url: paymentData.invoiceUrl,
        subscriptionId: subscription.id,
        asaasPaymentId: paymentData.id,
        value: plano.preco_mensal,
        planName: plano.nome,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("[create-subscription-card] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
