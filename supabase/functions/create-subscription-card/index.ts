import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// URL base é resolvida dinamicamente por resolveAsaasConfig

/**
 * Resolve a API key do Asaas para o barbeiro selecionado.
 * Se o barbeiro tiver sub-conta (asaas_api_key em barbeiros_private), usa ela.
 * Senão, usa a chave principal (ASAAS_API_KEY do env).
 */
async function resolveAsaasConfig(
  supabaseAdmin: any,
  barbeiroId: string,
  fallbackKey: string
): Promise<{ apiKey: string; baseUrl: string; isSubAccount: boolean }> {
  const { data: barberPrivate } = await supabaseAdmin
    .from("barbeiros_private")
    .select("asaas_api_key")
    .eq("barbeiro_id", barbeiroId)
    .maybeSingle();

  let apiKey = fallbackKey;
  let isSubAccount = false;

  if (barberPrivate?.asaas_api_key) {
    console.log("[create-subscription-card] Usando sub-conta do barbeiro:", barbeiroId);
    apiKey = barberPrivate.asaas_api_key;
    isSubAccount = true;
  } else {
    console.log("[create-subscription-card] Usando conta principal (sem sub-conta para barbeiro:", barbeiroId, ")");
  }

  const isSandbox = apiKey.includes("hmlg");
  const baseUrl = isSandbox ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3";
  if (isSandbox) console.log("[create-subscription-card] 🧪 Modo SANDBOX detectado");

  return { apiKey, baseUrl, isSubAccount };
}

/**
 * Busca ou cria customer no Asaas, sincronizando dados do profile
 */
async function getOrCreateAsaasCustomer(
  apiKey: string,
  baseUrl: string,
  user: { id: string; email: string; user_metadata?: any },
  supabaseAdmin: any
): Promise<string> {
  const headers = {
    "Content-Type": "application/json",
    access_token: apiKey,
  };

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("nome, cpf, telefone")
    .eq("id", user.id)
    .maybeSingle();

  const name = profile?.nome || user.user_metadata?.nome || user.user_metadata?.full_name || user.email.split("@")[0];
  const cpf = profile?.cpf?.replace(/\D/g, "") || user.user_metadata?.cpf || undefined;

  const searchRes = await fetch(
    `${baseUrl}/customers?email=${encodeURIComponent(user.email)}`,
    { headers }
  );
  const searchData = await searchRes.json();

  if (searchData.data?.length > 0) {
    const existingCustomer = searchData.data[0];

    if (cpf && (!existingCustomer.cpfCnpj || existingCustomer.cpfCnpj !== cpf || existingCustomer.name !== name)) {
      console.log("[create-subscription-card] Atualizando customer no Asaas:", existingCustomer.id);
      await fetch(`${baseUrl}/customers/${existingCustomer.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ name, cpfCnpj: cpf }),
      });
    }

    return existingCustomer.id;
  }

  const createRes = await fetch(`${baseUrl}/customers`, {
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
 * Edge Function: Cria ASSINATURA RECORRENTE via Cartão de Crédito no Asaas.
 * Usa a sub-conta do barbeiro quando disponível.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const globalAsaasKey = Deno.env.get("ASAAS_API_KEY");
    if (!globalAsaasKey) throw new Error("ASAAS_API_KEY não configurada");

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
    const { planoId, barbeiroId } = body;
    if (!planoId) throw new Error("planoId é obrigatório");
    if (!barbeiroId) throw new Error("barbeiroId é obrigatório");

    const origin = req.headers.get("origin") || "https://dubagenda.lovable.app";

    console.log("[create-subscription-card] Iniciando assinatura recorrente para plano:", planoId, "barbeiro:", barbeiroId);

    // Resolver API key + URL base (sub-conta do barbeiro ou principal)
    const { apiKey: asaasApiKey, baseUrl: ASAAS_BASE_URL, isSubAccount } = await resolveAsaasConfig(supabaseAdmin, barbeiroId, globalAsaasKey);

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

    // Deletar assinaturas "suspended" anteriores
    await supabaseAdmin
      .from("assinaturas")
      .delete()
      .eq("user_id", user.id)
      .eq("status", "suspended");

    // Buscar/criar customer no Asaas (usando a key resolvida)
    const customerId = await getOrCreateAsaasCustomer(asaasApiKey, ASAAS_BASE_URL, user, supabaseAdmin);
    console.log("[create-subscription-card] Asaas customer:", customerId, "isSubAccount:", isSubAccount);

    // Data de início: hoje
    const nextDueDate = new Date().toISOString().split("T")[0];

    // Criar ASSINATURA RECORRENTE no Asaas via /v3/subscriptions
    const subscriptionRes = await fetch(`${ASAAS_BASE_URL}/subscriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: asaasApiKey,
      },
      body: JSON.stringify({
        customer: customerId,
        billingType: "CREDIT_CARD",
        value: plano.preco_mensal,
        nextDueDate: nextDueDate,
        cycle: "MONTHLY",
        description: `Assinatura: ${plano.nome}`,
        externalReference: `sub_${user.id}_${planoId}`,
      }),
    });

    const subscriptionData = await subscriptionRes.json();
    if (subscriptionData.errors) {
      console.error("[create-subscription-card] Subscription error:", subscriptionData.errors);
      throw new Error("Erro ao criar assinatura recorrente: " + JSON.stringify(subscriptionData.errors));
    }

    const asaasSubscriptionId = subscriptionData.id;
    console.log("[create-subscription-card] Asaas subscription created:", asaasSubscriptionId);

    // Buscar a primeira cobrança gerada pela assinatura
    const paymentsRes = await fetch(
      `${ASAAS_BASE_URL}/subscriptions/${asaasSubscriptionId}/payments`,
      {
        headers: {
          "Content-Type": "application/json",
          access_token: asaasApiKey,
        },
      }
    );

    const paymentsData = await paymentsRes.json();
    const firstPayment = paymentsData.data?.[0];

    if (!firstPayment) {
      console.error("[create-subscription-card] No payment found for subscription");
      throw new Error("Erro ao localizar primeira cobrança da assinatura");
    }

    console.log("[create-subscription-card] First payment:", firstPayment.id, "invoiceUrl:", firstPayment.invoiceUrl);

    // Calcular próxima data de cobrança (1 mês)
    const nextBilling = new Date();
    nextBilling.setMonth(nextBilling.getMonth() + 1);

    // Criar assinatura no banco com status "suspended"
    const { data: subscription, error: subError } = await supabaseAdmin
      .from("assinaturas")
      .insert({
        user_id: user.id,
        plano_id: planoId,
        barbeiro_id: barbeiroId,
        status: "suspended",
        payment_method: "card",
        asaas_payment_id: firstPayment.id,
        gateway_subscription_id: asaasSubscriptionId,
        next_billing_date: nextBilling.toISOString().split("T")[0],
      })
      .select()
      .single();

    if (subError) {
      console.error("[create-subscription-card] DB insert error:", subError);
      throw new Error("Erro ao criar assinatura pendente");
    }

    return new Response(
      JSON.stringify({
        success: true,
        url: firstPayment.invoiceUrl,
        subscriptionId: subscription.id,
        asaasSubscriptionId: asaasSubscriptionId,
        asaasPaymentId: firstPayment.id,
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