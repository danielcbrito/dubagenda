import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface CreditRow {
  id: string;
  amount: number;
  description: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

interface EnrichedCredit {
  credit: CreditRow;
  endToEndId: string | null;
  paidCentavos: number;
  feeCentavos: number;
  netCentavos: number;
  chargeId: string | null;
}

/**
 * Looks up the real Woovi fee for a wallet credit by reading the original
 * woovi_charges row. The fee is `raw_response.pix.charge.fee` (centavos) —
 * the difference between what the client paid and what landed on the
 * barber's subaccount.
 */
async function enrichCredits(
  supabase: ReturnType<typeof createClient>,
  credits: CreditRow[],
): Promise<EnrichedCredit[]> {
  const correlationIds = credits
    .map((c) => (c.metadata as any)?.woovi_correlation_id)
    .filter((v): v is string => typeof v === "string" && v.length > 0);

  let chargesByCorrelation: Record<string, any> = {};
  if (correlationIds.length > 0) {
    const { data: charges } = await supabase
      .from("woovi_charges")
      .select("id, correlation_id, value_centavos, raw_response")
      .in("correlation_id", correlationIds);
    for (const ch of charges || []) {
      chargesByCorrelation[ch.correlation_id] = ch;
    }
  }

  return credits.map((credit) => {
    const meta = (credit.metadata || {}) as any;
    const correlationId: string | undefined = meta.woovi_correlation_id;
    const charge = correlationId ? chargesByCorrelation[correlationId] : null;
    const raw = charge?.raw_response ?? null;

    const endToEndId: string | null =
      raw?.pix?.endToEndId ?? raw?.endToEndId ?? raw?.charge?.endToEndId ?? meta.woovi_endToEndId ?? null;

    const paidCentavos = Number(
      charge?.value_centavos ?? meta.woovi_value_centavos ?? Math.round(Number(credit.amount) * 100),
    );

    // Dynamic fee from Woovi (taxa_woovi_centavos = paid - subaccount).
    const feeCentavos = Number(
      raw?.pix?.charge?.fee ?? raw?.charge?.fee ?? raw?.fee ?? 0,
    );

    const netCentavos = Math.max(0, paidCentavos - feeCentavos);

    return {
      credit,
      endToEndId,
      paidCentavos,
      feeCentavos,
      netCentavos,
      chargeId: charge?.id ?? null,
    };
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Token de autenticação ausente" });

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user) return json(401, { error: "Usuário não autenticado" });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json().catch(() => ({}));
    const action: string = body.action || "preview";

    // Pending PIX cancellation credits (status=completed, not yet consumed).
    const { data: rawCredits, error: cErr } = await supabase
      .from("wallet_transactions")
      .select("id, amount, description, created_at, metadata")
      .eq("user_id", user.id)
      .eq("type", "refund")
      .eq("status", "completed")
      .not("metadata->>woovi_endToEndId", "is", null)
      .order("created_at", { ascending: true });

    if (cErr) throw cErr;

    const credits = (rawCredits || []) as CreditRow[];
    const enriched = await enrichCredits(supabase, credits);

    const summary = enriched.map((e) => ({
      id: e.credit.id,
      description: e.credit.description,
      created_at: e.credit.created_at,
      amount: e.paidCentavos / 100,
      fee: e.feeCentavos / 100,
      net: e.netCentavos / 100,
      endToEndId: e.endToEndId,
    }));

    const grossCentavos = enriched.reduce((s, e) => s + e.paidCentavos, 0);
    const feeCentavos = enriched.reduce((s, e) => s + e.feeCentavos, 0);
    const netCentavos = enriched.reduce((s, e) => s + e.netCentavos, 0);

    const preview = {
      credits: summary,
      creditsCount: enriched.length,
      grossAmount: grossCentavos / 100,
      totalFee: feeCentavos / 100,
      netAmount: netCentavos / 100,
    };

    if (action === "preview") {
      return json(200, { preview: true, ...preview });
    }

    if (action !== "execute") {
      return json(400, { error: "Ação inválida." });
    }

    // ── EXECUTE ─────────────────────────────────────────────────────────
    const pixKey: string = (body.pixKey || "").toString().trim();
    if (pixKey.length < 5) return json(400, { error: "Chave Pix inválida." });
    if (enriched.length === 0 || netCentavos <= 0) {
      return json(400, { error: "Sem saldo de cancelamento disponível para reembolso." });
    }

    // Validate every credit has an endToEndId before calling Woovi.
    const missing = enriched.find((e) => !e.endToEndId || e.netCentavos <= 0);
    if (missing) {
      return json(400, {
        error: "Um ou mais créditos não possuem dados suficientes para reembolso. Contate o suporte.",
        creditId: missing.credit.id,
      });
    }

    const wooviAppId = Deno.env.get("ID_DO_APLICATIVO_WOOVI");
    if (!wooviAppId) return json(500, { error: "Gateway Woovi não configurado." });

    // Sequentially call Woovi refund per credit. Abort on the first failure
    // and DO NOT mutate any wallet rows.
    const successes: { credit: EnrichedCredit; correlationID: string }[] = [];
    for (const e of enriched) {
      const correlationID = `wallet-refund-${e.credit.id}-${Date.now()}`;
      const refundBody = {
        correlationID,
        transactionEndToEndId: e.endToEndId,
        value: e.netCentavos,
        pixKey,
      };

      let resp: Response;
      try {
        resp = await fetch("https://api.woovi.com/api/v1/refund", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: wooviAppId },
          body: JSON.stringify(refundBody),
        });
      } catch (err) {
        console.error("[woovi-client-refund] network error", err);
        return json(200, {
          error: "SERVICE_UNAVAILABLE",
          fallback: true,
          message: "Não foi possível contatar a Woovi. Tente novamente em instantes.",
          creditId: e.credit.id,
        });
      }

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        console.error(`[woovi-client-refund] Woovi error credit=${e.credit.id}`, resp.status, data);
        const isAuthBilling = resp.status === 401 || resp.status === 402;
        return json(isAuthBilling ? resp.status : 200, {
          error: isAuthBilling
            ? `Woovi retornou ${resp.status}: ${(data as any)?.error || "verifique a configuração."}`
            : "SERVICE_UNAVAILABLE",
          fallback: !isAuthBilling,
          message: "Nenhum reembolso foi processado. Tente novamente.",
          creditId: e.credit.id,
          details: data,
        });
      }

      successes.push({ credit: e, correlationID });
    }

    // ── ALL refunds succeeded — now mutate DB ───────────────────────────
    const creditIds = successes.map((s) => s.credit.credit.id);
    await supabase
      .from("wallet_transactions")
      .update({ status: "consumed" })
      .in("id", creditIds);

    const { data: balanceRow } = await supabase
      .from("wallet_balances")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle();

    const grossReais = grossCentavos / 100;
    const newBalance = Math.max(0, Number(((Number(balanceRow?.balance || 0)) - grossReais).toFixed(2)));

    await supabase
      .from("wallet_balances")
      .update({ balance: newBalance })
      .eq("user_id", user.id);

    await supabase.from("wallet_transactions").insert({
      user_id: user.id,
      type: "withdraw",
      amount: grossReais,
      status: "completed",
      description: `Reembolso PIX - ${successes.length} cancelamento(s), líquido R$ ${(netCentavos / 100).toFixed(2)} (taxa R$ ${(feeCentavos / 100).toFixed(2)})`,
      destination_pix_key: pixKey,
      metadata: {
        credits_count: successes.length,
        gross_amount: grossReais,
        total_fee: feeCentavos / 100,
        net_amount: netCentavos / 100,
        source_credit_ids: creditIds,
        woovi_correlations: successes.map((s) => s.correlationID),
      },
    });

    return json(200, {
      success: true,
      creditsProcessed: successes.length,
      grossAmount: grossReais,
      totalFee: feeCentavos / 100,
      netAmount: netCentavos / 100,
      message: `Reembolso de R$ ${(netCentavos / 100).toFixed(2)} enviado para a sua chave Pix.`,
    });
  } catch (err) {
    console.error("[woovi-client-refund] unexpected", err);
    return json(200, {
      error: "SERVICE_FAILED",
      fallback: true,
      message: "Falha inesperada. Nenhum reembolso foi processado.",
    });
  }
});
