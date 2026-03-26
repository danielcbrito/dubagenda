import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    apiKey = barberPrivate.asaas_api_key;
    isSubAccount = true;
  }

  const isSandbox = apiKey.includes("hmlg");
  const baseUrl = isSandbox ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3";

  return { apiKey, baseUrl, isSubAccount };
}

async function getOrCreateAsaasCustomer(
  apiKey: string,
  baseUrl: string,
  user: { id: string; email: string; user_metadata?: any },
  supabaseAdmin: any
): Promise<string> {
  const headers = { "Content-Type": "application/json", access_token: apiKey };

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("nome, cpf, telefone")
    .eq("id", user.id)
    .maybeSingle();

  const name = profile?.nome || user.user_metadata?.nome || user.email.split("@")[0];
  const cpf = profile?.cpf?.replace(/\D/g, "") || undefined;

  const searchRes = await fetch(`${baseUrl}/customers?email=${encodeURIComponent(user.email)}`, { headers });
  const searchData = await searchRes.json();

  if (searchData.data?.length > 0) {
    const existing = searchData.data[0];
    if (cpf && (!existing.cpfCnpj || existing.cpfCnpj !== cpf || existing.name !== name)) {
      await fetch(`${baseUrl}/customers/${existing.id}`, {
        method: "PUT", headers, body: JSON.stringify({ name, cpfCnpj: cpf }),
      });
    }
    return existing.id;
  }

  const createRes = await fetch(`${baseUrl}/customers`, {
    method: "POST", headers,
    body: JSON.stringify({ name, email: user.email, cpfCnpj: cpf, externalReference: user.id }),
  });
  const createData = await createRes.json();
  if (createData.errors) throw new Error("Erro ao criar cliente Asaas: " + JSON.stringify(createData.errors));
  return createData.id;
}

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

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("Usuário não autenticado");

    const body = await req.json();
    const { assinaturaId, formaPagamento } = body;
    if (!assinaturaId) throw new Error("assinaturaId é obrigatório");
    if (!formaPagamento || !["pix", "cartao", "dinheiro"].includes(formaPagamento)) {
      throw new Error("formaPagamento inválida");
    }

    console.log("[renew-subscription] Iniciando renovação:", assinaturaId, formaPagamento);

    // Buscar assinatura atual
    const { data: sub, error: subError } = await supabaseAdmin
      .from("assinaturas")
      .select("*, plano:planos(id, nome, preco_mensal, limite_agendamentos_mes, servico_id)")
      .eq("id", assinaturaId)
      .eq("user_id", user.id)
      .single();

    if (subError || !sub) throw new Error("Assinatura não encontrada");
    if (sub.status !== "active") throw new Error("Assinatura não está ativa");

    // Verificar que usou todos os serviços
    const limite = sub.plano?.limite_agendamentos_mes || 4;
    if (sub.usos_ciclo_atual < limite) {
      throw new Error(`Ainda restam ${limite - sub.usos_ciclo_atual} serviço(s) para usar antes de renovar`);
    }

    const barbeiroId = sub.barbeiro_id;
    if (!barbeiroId) throw new Error("Barbeiro não vinculado à assinatura");

    const today = new Date();
    const nextBilling = new Date(today);
    nextBilling.setDate(nextBilling.getDate() + 30);
    const todayStr = today.toISOString().split("T")[0];
    const nextBillingStr = nextBilling.toISOString().split("T")[0];

    if (formaPagamento === "dinheiro") {
      // Renovação com pagamento em dinheiro — ativa imediatamente com pending_cash flag
      const { error: updateError } = await supabaseAdmin
        .from("assinaturas")
        .update({
          ciclo_inicio: todayStr,
          ciclo_fim: nextBillingStr,
          next_billing_date: nextBillingStr,
          usos_ciclo_atual: 0,
          total_renovacoes: (sub.total_renovacoes || 0) + 1,
          renovada_antecipadamente: true,
          payment_method: "cash",
          cash_payment_confirmed: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", assinaturaId);

      if (updateError) throw new Error("Erro ao renovar assinatura: " + updateError.message);

      return new Response(
        JSON.stringify({ success: true, method: "dinheiro", message: "Plano renovado! Pague na barbearia." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    if (formaPagamento === "pix") {
      const { apiKey, baseUrl } = await resolveAsaasConfig(supabaseAdmin, barbeiroId, globalAsaasKey);
      const customerId = await getOrCreateAsaasCustomer(apiKey, baseUrl, user, supabaseAdmin);

      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 30);
      const dueDateStr = expiresAt.toISOString().split("T")[0];

      const paymentRes = await fetch(`${baseUrl}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", access_token: apiKey },
        body: JSON.stringify({
          customer: customerId,
          billingType: "PIX",
          value: sub.plano.preco_mensal,
          dueDate: dueDateStr,
          description: `Renovação: ${sub.plano.nome}`,
          externalReference: `renew_${user.id}_${assinaturaId}`,
        }),
      });

      const paymentData = await paymentRes.json();
      if (paymentData.errors) throw new Error("Erro ao gerar PIX: " + JSON.stringify(paymentData.errors));

      const qrRes = await fetch(`${baseUrl}/payments/${paymentData.id}/pixQrCode`, {
        headers: { "Content-Type": "application/json", access_token: apiKey },
      });
      const qrData = await qrRes.json();
      if (!qrData.encodedImage || !qrData.payload) throw new Error("Erro ao gerar QR Code PIX");

      // Marcar assinatura como pending_renewal com dados PIX
      const { error: updateError } = await supabaseAdmin
        .from("assinaturas")
        .update({
          status: "pending_renewal",
          asaas_payment_id: paymentData.id,
          pix_qr_code: qrData.encodedImage,
          pix_payload: qrData.payload,
          pix_expires_at: expiresAt.toISOString(),
          payment_method: "pix",
          updated_at: new Date().toISOString(),
        })
        .eq("id", assinaturaId);

      if (updateError) throw new Error("Erro ao atualizar assinatura: " + updateError.message);

      return new Response(
        JSON.stringify({
          success: true,
          method: "pix",
          pixQrCode: qrData.encodedImage,
          pixPayload: qrData.payload,
          expiresAt: expiresAt.toISOString(),
          asaasPaymentId: paymentData.id,
          value: sub.plano.preco_mensal,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    if (formaPagamento === "cartao") {
      const { apiKey, baseUrl } = await resolveAsaasConfig(supabaseAdmin, barbeiroId, globalAsaasKey);
      const customerId = await getOrCreateAsaasCustomer(apiKey, baseUrl, user, supabaseAdmin);

      // Criar link de pagamento para cartão
      const paymentRes = await fetch(`${baseUrl}/paymentLinks`, {
        method: "POST",
        headers: { "Content-Type": "application/json", access_token: apiKey },
        body: JSON.stringify({
          name: `Renovação: ${sub.plano.nome}`,
          billingType: "CREDIT_CARD",
          chargeType: "DETACHED",
          value: sub.plano.preco_mensal,
          maxInstallmentCount: 1,
          description: `Renovação do plano ${sub.plano.nome}`,
          externalReference: `renew_${user.id}_${assinaturaId}`,
        }),
      });

      const paymentData = await paymentRes.json();
      if (paymentData.errors) throw new Error("Erro ao criar link: " + JSON.stringify(paymentData.errors));

      // Marcar como pending_renewal
      await supabaseAdmin
        .from("assinaturas")
        .update({
          status: "pending_renewal",
          payment_method: "credit_card",
          updated_at: new Date().toISOString(),
        })
        .eq("id", assinaturaId);

      return new Response(
        JSON.stringify({
          success: true,
          method: "cartao",
          paymentUrl: paymentData.url,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    throw new Error("Método de pagamento não suportado");
  } catch (error) {
    console.error("[renew-subscription] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
