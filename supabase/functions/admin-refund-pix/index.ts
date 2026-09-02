// Edge Function: admin-refund-pix
// Estorno manual de PIX via Woovi para casos de recuperação.
// Requer header X-Admin-Secret. NÃO expor no frontend.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { agendamento_id } = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: charge } = await supabase
      .from("woovi_charges")
      .select("correlation_id, raw_response, value_centavos, agendamento_id")
      .eq("agendamento_id", agendamento_id)
      .eq("status", "PAID")
      .maybeSingle();
    if (!charge) {
      return new Response(JSON.stringify({ error: "Charge não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const raw = charge.raw_response as any;
    const endToEndId = raw?.pix?.endToEndId ?? raw?.endToEndId;
    const subPixKey =
      raw?.charge?.subaccount?.pixKey ?? raw?.subaccount?.pixKey ?? raw?.pix?.charge?.subaccount?.pixKey;
    const wooviAppId = Deno.env.get("ID_DO_APLICATIVO_WOOVI")!;
    const refundBody: Record<string, unknown> = {
      correlationID: `refund-${agendamento_id}-${Date.now()}`,
      transactionEndToEndId: endToEndId,
      value: charge.value_centavos,
    };
    if (subPixKey) refundBody.pixKey = subPixKey;
    const resp = await fetch("https://api.woovi.com/api/v1/refund", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: wooviAppId },
      body: JSON.stringify(refundBody),
    });
    const data = await resp.json().catch(() => ({}));
    if (resp.ok) {
      await supabase.from("pagamentos").update({ status: "refunded" }).eq("agendamento_id", agendamento_id);
    }
    return new Response(JSON.stringify({ ok: resp.ok, status: resp.status, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
