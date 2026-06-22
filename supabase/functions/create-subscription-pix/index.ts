// Edge Function: create-subscription-pix
// Gera cobrança PIX (Woovi) para assinatura de plano, direcionando para a subconta do barbeiro.
// Requer que o barbeiro possua woovi_pix_key cadastrada; caso contrário, retorna erro.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const WOOVI_API = "https://api.woovi.com";
const EXPIRES_SECONDS = 30 * 60;
const SERVICE_FEE = 0.9; // Taxa de serviço cobrada do cliente em pagamentos online (PIX/Cartão)

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const wooviAppId = Deno.env.get("ID_DO_APLICATIVO_WOOVI");

    if (!wooviAppId) {
      return new Response(
        JSON.stringify({ error: "ID_DO_APLICATIVO_WOOVI não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Autenticar cliente
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const { planoId, barbeiroId } = body ?? {};
    if (!planoId) throw new Error("planoId é obrigatório");
    if (!barbeiroId) throw new Error("barbeiroId é obrigatório");

    const admin = createClient(supabaseUrl, serviceKey);

    // 1. Buscar barbeiro + chave Woovi
    const { data: barber, error: barberErr } = await admin
      .from("barbeiros")
      .select("id, apelido, woovi_pix_key")
      .eq("id", barbeiroId)
      .maybeSingle();

    if (barberErr || !barber?.woovi_pix_key) {
      return new Response(
        JSON.stringify({ error: "Este profissional não aceita PIX no momento. Pague na barbearia." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Buscar plano
    const { data: plano, error: planoError } = await admin
      .from("planos")
      .select("id, nome, preco_mensal")
      .eq("id", planoId)
      .eq("ativo", true)
      .single();
    if (planoError || !plano) throw new Error("Plano não encontrado ou inativo");

    // 3. Garantir que não há assinatura ativa
    const { data: existingSub } = await admin
      .from("assinaturas")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (existingSub) throw new Error("Você já possui uma assinatura ativa");

    // Limpar suspended anteriores
    await admin
      .from("assinaturas")
      .delete()
      .eq("user_id", userId)
      .eq("status", "suspended");

    // 4. Garantir subconta Woovi (idempotente)
    const subaccountPixKey = barber.woovi_pix_key as string;
    const ensureResp = await fetch(`${WOOVI_API}/api/v1/subaccount`, {
      method: "POST",
      headers: { Authorization: wooviAppId, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: barber.apelido ?? `Barbeiro ${barbeiroId.slice(0, 8)}`,
        pixKey: subaccountPixKey,
      }),
    });
    if (!ensureResp.ok) {
      const ensureJson = await ensureResp.json().catch(() => ({}));
      const msg = String(ensureJson?.error ?? ensureJson?.message ?? "");
      const alreadyExists = /exist|already|cadastrad/i.test(msg);
      if (!alreadyExists) {
        console.error("[create-subscription-pix] subaccount error:", ensureResp.status, ensureJson);
        return new Response(
          JSON.stringify({ error: "Falha ao registrar subconta do barbeiro na Woovi", details: msg || ensureJson }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } else {
      await ensureResp.text().catch(() => undefined);
    }

    // 5. Criar assinatura suspended (pega o id antes p/ correlationID)
    const expiresAt = new Date(Date.now() + EXPIRES_SECONDS * 1000);
    const { data: subscription, error: subError } = await admin
      .from("assinaturas")
      .insert({
        user_id: userId,
        plano_id: planoId,
        barbeiro_id: barbeiroId,
        status: "suspended",
        payment_method: "pix",
        pix_expires_at: expiresAt.toISOString(),
      })
      .select("id")
      .single();
    if (subError || !subscription) {
      console.error("[create-subscription-pix] insert error:", subError);
      throw new Error("Erro ao criar assinatura pendente");
    }

    const correlationID = `sub-${subscription.id}`;
    const valueCentavos = Math.round(Number(plano.preco_mensal) * 100);

    // 6. Criar cobrança na Woovi
    const wooviResp = await fetch(`${WOOVI_API}/api/v1/charge`, {
      method: "POST",
      headers: { Authorization: wooviAppId, "Content-Type": "application/json" },
      body: JSON.stringify({
        correlationID,
        value: valueCentavos,
        comment: `Assinatura: ${plano.nome}`.slice(0, 140),
        expiresIn: EXPIRES_SECONDS,
        subaccount: subaccountPixKey,
        additionalInfo: [
          { key: "Plano", value: plano.nome },
          { key: "Barbeiro", value: barber.apelido ?? "" },
        ],
      }),
    });

    const wooviJson = await wooviResp.json().catch(() => ({}));
    if (!wooviResp.ok) {
      console.error("[create-subscription-pix] Woovi charge error:", wooviResp.status, wooviJson);
      await admin.from("assinaturas").delete().eq("id", subscription.id);
      return new Response(
        JSON.stringify({ error: "Falha ao criar cobrança Woovi", details: wooviJson?.error ?? wooviJson }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const charge = wooviJson.charge ?? wooviJson;
    const brCode: string = charge.brCode ?? charge.paymentLinkUrl ?? "";
    const qrImage: string = (charge.qrCodeImage ?? "").replace(/^data:image\/png;base64,/, "");
    const chargeId: string = charge.identifier ?? charge.transactionID ?? correlationID;

    // 7. Persistir woovi_charges
    await admin.from("woovi_charges").insert({
      agendamento_id: null,
      barbeiro_id: barbeiroId,
      user_id: userId,
      correlation_id: correlationID,
      charge_id: chargeId,
      br_code: brCode,
      qr_code_image: qrImage,
      value_centavos: valueCentavos,
      status: "PENDING",
      raw_response: wooviJson,
    });

    // 8. Atualizar assinatura com dados do PIX (asaas_payment_id reaproveitado p/ correlation)
    await admin
      .from("assinaturas")
      .update({
        asaas_payment_id: correlationID,
        pix_qr_code: qrImage,
        pix_payload: brCode,
        pix_expires_at: expiresAt.toISOString(),
      })
      .eq("id", subscription.id);

    return new Response(
      JSON.stringify({
        success: true,
        subscriptionId: subscription.id,
        asaasPaymentId: correlationID,
        pixQrCode: qrImage,
        pixPayload: brCode,
        expiresAt: expiresAt.toISOString(),
        value: plano.preco_mensal,
        planName: plano.nome,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    console.error("[create-subscription-pix] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
