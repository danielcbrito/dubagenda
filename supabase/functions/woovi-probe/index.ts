// Temporary probe: tests Woovi API connectivity and charge creation.
// Remove after diagnosis.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const wooviAppId = Deno.env.get("ID_DO_APLICATIVO_WOOVI");
  if (!wooviAppId) {
    return new Response(JSON.stringify({ ok: false, error: "no_secret" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const pixKey = url.searchParams.get("pixKey") ?? "+5511952263002";

  // Test 1: subaccount create
  const subResp = await fetch("https://api.woovi.com/api/v1/subaccount", {
    method: "POST",
    headers: { Authorization: wooviAppId, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Probe", pixKey }),
  });
  const subJson = await subResp.json().catch(() => ({}));

  // Test 2: create charge
  const correlationID = `probe-${Date.now()}`;
  const chargeResp = await fetch("https://api.woovi.com/api/v1/charge", {
    method: "POST",
    headers: { Authorization: wooviAppId, "Content-Type": "application/json" },
    body: JSON.stringify({
      correlationID,
      value: 100,
      comment: "Probe",
      expiresIn: 1800,
      subaccount: pixKey,
    }),
  });
  const chargeJson = await chargeResp.json().catch(() => ({}));

  return new Response(
    JSON.stringify({
      appIdLen: wooviAppId.length,
      appIdPrefix: wooviAppId.slice(0, 6),
      subaccount: { status: subResp.status, body: subJson },
      charge: { status: chargeResp.status, body: chargeJson },
    }, null, 2),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
