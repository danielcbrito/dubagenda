const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!GOOGLE_MAPS_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_MAPS_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { address } = await req.json();
    if (!address || typeof address !== "string") {
      return new Response(
        JSON.stringify({ error: "address is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const params = new URLSearchParams({
      address,
      key: GOOGLE_MAPS_API_KEY,
      region: "br",
      language: "pt-BR",
    });

    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`
    );

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `Google API error: ${res.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();

    if (data.status !== "OK" || !data.results?.length) {
      return new Response(
        JSON.stringify({ lat: null, lng: null, exact: false, status: data.status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = data.results[0];
    const location = result.geometry?.location;
    const locationType = result.geometry?.location_type;

    return new Response(
      JSON.stringify({
        lat: location?.lat ?? null,
        lng: location?.lng ?? null,
        exact: locationType === "ROOFTOP" || locationType === "RANGE_INTERPOLATED",
        locationType,
        formattedAddress: result.formatted_address ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
