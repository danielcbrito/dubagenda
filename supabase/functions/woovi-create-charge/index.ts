// Edge Function: woovi-create-charge
// Cria uma cobrança PIX via API da Woovi, direcionando o split para a chave Pix do barbeiro.
// Retorna { charge_id, correlation_id, br_code, qr_code_image, expires_at, pending_booking_id }

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const WOOVI_API = "https://api.woovi.com";
const EXPIRES_SECONDS = 30 * 60;

const jsonResponse = (body: unknown, status = 200) => new Response(
  JSON.stringify(body),
  { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
);

const getWooviErrorMessage = (payload: unknown): string => {
  if (!payload || typeof payload !== "object") return "";
  const value = payload as {
    error?: unknown;
    message?: unknown;
    errors?: Array<{ message?: unknown }>;
  };
  if (typeof value.error === "string") return value.error;
  if (typeof value.message === "string") return value.message;
  const nestedMessage = value.errors?.find((item) => typeof item?.message === "string")?.message;
  return typeof nestedMessage === "string" ? nestedMessage : "";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const wooviAppId = Deno.env.get("ID_DO_APLICATIVO_WOOVI");

    if (!supabaseUrl || !serviceKey || !anonKey) {
      console.error("woovi-create-charge: configuração Supabase ausente");
      return jsonResponse({ error: "Serviço de pagamento temporariamente indisponível", code: "PAYMENT_CONFIG_ERROR" }, 503);
    }

    if (!wooviAppId) {
      console.error("woovi-create-charge: ID_DO_APLICATIVO_WOOVI ausente");
      return jsonResponse({ error: "Pagamento PIX temporariamente indisponível", code: "WOOVI_AUTH_MISSING" }, 503);
    }

    // Autenticar cliente
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return jsonResponse({ error: "Não autenticado" }, 401);
    }
    const userId = userData.user.id;

    const body = await req.json();
    const {
      barbeiro_id,
      valor,
      descricao,
      servico_id,
      data: bookingDate,
      hora: bookingHora,
      duracao,
      observacoes,
    } = body;

    if (!barbeiro_id || !valor || valor <= 0) {
      return new Response(
        JSON.stringify({ error: "barbeiro_id e valor obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // 1. Buscar woovi_pix_key do barbeiro
    const { data: barber, error: barberErr } = await admin
      .from("barbeiros")
      .select("id, apelido, woovi_pix_key")
      .eq("id", barbeiro_id)
      .maybeSingle();

    if (barberErr || !barber?.woovi_pix_key) {
      return new Response(
        JSON.stringify({
          error: "Este profissional não aceita PIX no momento.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Criar pending_booking
    let pendingBookingId: string | null = null;
    if (servico_id && bookingDate && bookingHora) {
      // 2.0 Validar que o slot ainda está livre em agendamentos (status ativos)
      const { data: slotConflict } = await admin
        .from("agendamentos")
        .select("id")
        .eq("barbeiro_id", barbeiro_id)
        .eq("data", bookingDate)
        .eq("hora", bookingHora)
        .in("status", ["pending", "confirmed"])
        .limit(1)
        .maybeSingle();

      if (slotConflict) {
        return new Response(
          JSON.stringify({
            error: "Horário indisponível",
            details: "Este horário acabou de ser reservado por outro cliente. Escolha outro horário.",
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // 2.1 Validar contra outros pending_bookings ativos do mesmo slot (de outros usuários)
      const { data: pbConflict } = await admin
        .from("pending_bookings")
        .select("id, user_id")
        .eq("barbeiro_id", barbeiro_id)
        .eq("data", bookingDate)
        .eq("hora", bookingHora)
        .gt("expires_at", new Date().toISOString())
        .neq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (pbConflict) {
        return new Response(
          JSON.stringify({
            error: "Horário indisponível",
            details: "Outro cliente está finalizando o pagamento deste horário. Tente novamente em alguns minutos.",
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const expiresAt = new Date(Date.now() + EXPIRES_SECONDS * 1000).toISOString();
      const { data: pb, error: pbErr } = await admin
        .from("pending_bookings")
        .insert({
          user_id: userId,
          barbeiro_id,
          servico_id,
          data: bookingDate,
          hora: bookingHora,
          duracao: duracao ?? 30,
          preco: valor,
          observacoes: observacoes ?? null,
          payment_method: "pix",
          expires_at: expiresAt,
        })
        .select("id")
        .single();
      if (pbErr) {
        return new Response(
          JSON.stringify({ error: "Slot indisponível", details: pbErr.message }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      pendingBookingId = pb.id;
    }

    // 3. Garantir que a subconta Woovi existe (idempotente)
    // Woovi exige que a pixKey esteja registrada como subaccount antes de cobrar.
    const subaccountPixKey = barber.woovi_pix_key;
    const ensureResp = await fetch(`${WOOVI_API}/api/v1/subaccount`, {
      method: "POST",
      headers: {
        Authorization: wooviAppId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: barber.apelido ?? `Barbeiro ${barbeiro_id.slice(0, 8)}`,
        pixKey: subaccountPixKey,
      }),
    });
    if (!ensureResp.ok) {
      const ensureJson: unknown = await ensureResp.json().catch(() => ({}));
      const msg = getWooviErrorMessage(ensureJson);
      // Ignora "já existe"; aborta em outros erros
      const alreadyExists = /exist|already|cadastrad/i.test(msg);
      if (!alreadyExists) {
        console.error("Woovi subaccount create error:", ensureResp.status, ensureJson);
        if (pendingBookingId) {
          await admin.from("pending_bookings").delete().eq("id", pendingBookingId);
        }
        const invalidCredential = ensureResp.status === 401 || /appid inv[aá]lido|unauthorized/i.test(msg);
        return jsonResponse({
          error: invalidCredential
            ? "Pagamento PIX temporariamente indisponível. Escolha outra forma de pagamento."
            : "Não foi possível iniciar o pagamento PIX. Tente novamente.",
          code: invalidCredential ? "WOOVI_AUTH_INVALID" : "WOOVI_SUBACCOUNT_ERROR",
        }, invalidCredential ? 503 : 502);
      }
    } else {
      await ensureResp.text().catch(() => undefined);
    }

    // 4. Criar cobrança na Woovi via SUBACCOUNT do barbeiro
    // O valor cai direto na subconta do barbeiro (CNPJ/CPF dele) — Receita Federal
    // reconhece a receita como sendo do barbeiro, não da plataforma.
    // O estorno em caso de cancelamento é feito via /api/v1/refund informando o pixKey
    // da subconta, que debita o saldo do próprio barbeiro.
    const correlationID = `book-${pendingBookingId ?? crypto.randomUUID()}`;
    const valueCentavos = Math.round(Number(valor) * 100);

    const wooviPayload: Record<string, unknown> = {
      correlationID,
      value: valueCentavos,
      comment: (descricao || "Agendamento").slice(0, 140),
      expiresIn: EXPIRES_SECONDS,
      subaccount: subaccountPixKey,
      additionalInfo: [
        { key: "Barbeiro", value: barber.apelido ?? "" },
        { key: "BarbeiroPixKey", value: subaccountPixKey },
      ],
    };


    const wooviResp = await fetch(`${WOOVI_API}/api/v1/charge`, {
      method: "POST",
      headers: {
        Authorization: wooviAppId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(wooviPayload),
    });

    const wooviJson = await wooviResp.json().catch(() => ({}));
    if (!wooviResp.ok) {
      console.error("Woovi error:", wooviResp.status, wooviJson);
      // Limpar pending_booking
      if (pendingBookingId) {
        await admin.from("pending_bookings").delete().eq("id", pendingBookingId);
      }
      return new Response(
        JSON.stringify({
          error: "Falha ao criar cobrança Woovi",
          details: wooviJson?.error ?? wooviJson,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const charge = wooviJson.charge ?? wooviJson;
    const brCode: string = charge.brCode ?? charge.paymentLinkUrl ?? "";

    const qrImage: string = charge.qrCodeImage ?? "";
    const chargeId: string = charge.identifier ?? charge.transactionID ?? correlationID;
    const expiresAt = new Date(Date.now() + EXPIRES_SECONDS * 1000).toISOString();

    // 4. Persistir cobrança
    const { error: insErr } = await admin.from("woovi_charges").insert({
      agendamento_id: null,
      barbeiro_id,
      user_id: userId,
      correlation_id: correlationID,
      charge_id: chargeId,
      br_code: brCode,
      qr_code_image: qrImage,
      value_centavos: valueCentavos,
      status: "PENDING",
      raw_response: wooviJson,
    });
    if (insErr) {
      console.error("Erro ao persistir woovi_charges:", insErr);
    }

    return new Response(
      JSON.stringify({
        charge_id: chargeId,
        correlation_id: correlationID,
        br_code: brCode,
        qr_code_image: qrImage,
        expires_at: expiresAt,
        pending_booking_id: pendingBookingId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("woovi-create-charge error:", e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
