// Edge Function: release-barber-payment
// Quando um agendamento PIX é marcado como 'completed', transfere o valor
// retido na conta-mãe Woovi para a chave PIX do barbeiro.
// Idempotente: usa woovi_charges.released_at para evitar repasses duplicados.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const wooviAppId = Deno.env.get("ID_DO_APLICATIVO_WOOVI");
    if (!wooviAppId) {
      return new Response(JSON.stringify({ error: "ID_DO_APLICATIVO_WOOVI não configurado" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { agendamento_id } = await req.json();
    if (!agendamento_id) {
      return new Response(JSON.stringify({ error: "agendamento_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Buscar charge PIX paga ainda não repassada
    const { data: charge } = await supabase
      .from("woovi_charges")
      .select("id, value_centavos, barbeiro_id, released_at, raw_response")
      .eq("agendamento_id", agendamento_id)
      .eq("status", "PAID")
      .maybeSingle();

    if (!charge) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_paid_charge" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (charge.released_at) {
      return new Response(JSON.stringify({ ok: true, skipped: "already_released" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Chave PIX do barbeiro
    const { data: barber } = await supabase
      .from("barbeiros")
      .select("apelido, woovi_pix_key")
      .eq("id", charge.barbeiro_id)
      .maybeSingle();
    if (!barber?.woovi_pix_key) {
      return new Response(JSON.stringify({ error: "Barbeiro sem chave PIX" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Repasse: desconta taxa de serviço (R$ 0,90) que ficamos como plataforma
    const SERVICE_FEE_CENTS = 90;
    const payoutValue = Math.max(0, (charge.value_centavos ?? 0) - SERVICE_FEE_CENTS);
    if (payoutValue <= 0) {
      await supabase.from("woovi_charges")
        .update({ released_at: new Date().toISOString() })
        .eq("id", charge.id);
      return new Response(JSON.stringify({ ok: true, skipped: "zero_payout" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PIX out via Woovi
    const correlationID = `payout-${agendamento_id}`;
    const resp = await fetch("https://api.woovi.com/api/v1/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: wooviAppId },
      body: JSON.stringify({
        value: payoutValue,
        pixKey: barber.woovi_pix_key,
        correlationID,
        comment: `Repasse agendamento ${agendamento_id.slice(0, 8)}`,
      }),
    });
    const data = await resp.json().catch(() => ({}));

    if (resp.ok) {
      await supabase.from("woovi_charges")
        .update({ released_at: new Date().toISOString() })
        .eq("id", charge.id);
      console.log(`[release-barber-payment] Repassado ${payoutValue}c para ${barber.apelido}`);
      return new Response(JSON.stringify({ ok: true, payout_centavos: payoutValue, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      console.error("[release-barber-payment] Falha transfer Woovi:", data);
      return new Response(JSON.stringify({ ok: false, status: resp.status, data }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("[release-barber-payment] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
