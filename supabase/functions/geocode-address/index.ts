const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BRAZIL_BOUNDS = {
  minLat: -35.5,
  maxLat: 5.5,
  minLng: -74.5,
  maxLng: -28,
};

type GeocodeInput = {
  address?: string;
  components?: {
    rua?: string | null;
    numero?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    estado?: string | null;
    cep?: string | null;
  };
};

type GoogleAddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

type GoogleGeocodeResult = {
  formatted_address?: string;
  partial_match?: boolean;
  address_components?: GoogleAddressComponent[];
  geometry?: {
    location?: {
      lat?: number;
      lng?: number;
    };
    location_type?: string;
  };
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function digitsOnly(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function isWithinBrazil(lat: number, lng: number) {
  return (
    lat >= BRAZIL_BOUNDS.minLat &&
    lat <= BRAZIL_BOUNDS.maxLat &&
    lng >= BRAZIL_BOUNDS.minLng &&
    lng <= BRAZIL_BOUNDS.maxLng
  );
}

function getComponent(
  result: GoogleGeocodeResult,
  types: string[],
  short = false,
) {
  const component = result.address_components?.find((entry) =>
    entry.types?.some((type) => types.includes(type))
  );

  if (!component) return null;
  return short ? component.short_name : component.long_name;
}

function matchesText(actual: string | null | undefined, expected: string | null | undefined) {
  const actualNormalized = normalizeText(actual);
  const expectedNormalized = normalizeText(expected);

  if (!actualNormalized || !expectedNormalized) return false;
  return (
    actualNormalized.includes(expectedNormalized) ||
    expectedNormalized.includes(actualNormalized)
  );
}

function scoreResult(result: GoogleGeocodeResult, input: GeocodeInput) {
  const lat = result.geometry?.location?.lat;
  const lng = result.geometry?.location?.lng;

  if (typeof lat !== "number" || typeof lng !== "number") {
    return Number.NEGATIVE_INFINITY;
  }

  if (!isWithinBrazil(lat, lng)) {
    return Number.NEGATIVE_INFINITY;
  }

  const components = input.components ?? {};
  let score = 0;

  switch (result.geometry?.location_type) {
    case "ROOFTOP":
      score += 40;
      break;
    case "RANGE_INTERPOLATED":
      score += 30;
      break;
    case "GEOMETRIC_CENTER":
      score += 18;
      break;
    case "APPROXIMATE":
      score += 8;
      break;
  }

  if (result.partial_match === true) {
    score -= 12;
  }

  const route = getComponent(result, ["route"]);
  const streetNumber = getComponent(result, ["street_number"]);
  const neighborhood = getComponent(result, ["sublocality_level_1", "sublocality", "neighborhood"]);
  const city = getComponent(result, ["locality", "administrative_area_level_2"]);
  const state = getComponent(result, ["administrative_area_level_1"], true);
  const postalCode = getComponent(result, ["postal_code"]);

  if (components.rua) {
    score += matchesText(route, components.rua) ? 22 : -10;
  }

  if (components.numero) {
    score += digitsOnly(streetNumber) === digitsOnly(components.numero) ? 18 : -6;
  }

  if (components.bairro && matchesText(neighborhood, components.bairro)) {
    score += 10;
  }

  if (components.cidade) {
    score += matchesText(city, components.cidade) ? 16 : -18;
  }

  if (components.estado) {
    score += matchesText(state, components.estado) ? 8 : -10;
  }

  if (components.cep) {
    score += digitsOnly(postalCode) === digitsOnly(components.cep) ? 16 : 0;
  }

  if (input.address && matchesText(result.formatted_address, input.address)) {
    score += 10;
  }

  return score;
}

function buildAddressCandidates(input: GeocodeInput) {
  const candidates = new Set<string>();
  const trimmedAddress = input.address?.trim();

  if (trimmedAddress) {
    candidates.add(trimmedAddress);
  }

  const components = input.components ?? {};
  const streetFirst = [
    components.rua,
    components.numero,
    components.bairro,
    components.cidade,
    components.estado,
    components.cep,
    "Brasil",
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  if (streetFirst.length >= 4) {
    candidates.add(streetFirst.join(", "));
  }

  const noPostalCode = [
    components.rua,
    components.numero,
    components.bairro,
    components.cidade,
    components.estado,
    "Brasil",
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  if (noPostalCode.length >= 4) {
    candidates.add(noPostalCode.join(", "));
  }

  return [...candidates];
}

function buildGoogleComponents(input: GeocodeInput) {
  const components = input.components ?? {};
  const filters = ["country:BR"];

  if (components.estado?.trim()) {
    filters.push(`administrative_area:${components.estado.trim()}`);
  }

  if (components.cidade?.trim()) {
    filters.push(`locality:${components.cidade.trim()}`);
  }

  if (components.cep?.trim()) {
    filters.push(`postal_code:${digitsOnly(components.cep)}`);
  }

  return filters.join("|");
}

async function fetchResults(address: string, apiKey: string, googleComponents: string) {
  const params = new URLSearchParams({
    address,
    key: apiKey,
    region: "br",
    language: "pt-BR",
  });

  if (googleComponents) {
    params.set("components", googleComponents);
  }

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`,
  );

  if (!res.ok) {
    throw new Error(`Google API error: ${res.status}`);
  }

  const payload = await res.json();
  if (payload.status !== "OK" || !Array.isArray(payload.results)) {
    return [] as GoogleGeocodeResult[];
  }

  return payload.results as GoogleGeocodeResult[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!GOOGLE_MAPS_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_MAPS_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const input = (await req.json()) as GeocodeInput;
    if (!input.address || typeof input.address !== "string") {
      return new Response(
        JSON.stringify({ error: "address is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const candidates = buildAddressCandidates(input);
    const googleComponents = buildGoogleComponents(input);

    let selectedQuery: string | null = null;
    let results: GoogleGeocodeResult[] = [];

    for (const candidate of candidates) {
      const nextResults = await fetchResults(candidate, GOOGLE_MAPS_API_KEY, googleComponents);
      if (nextResults.length > 0) {
        selectedQuery = candidate;
        results = nextResults;
        break;
      }
    }

    if (!results.length) {
      return new Response(
        JSON.stringify({ lat: null, lng: null, exact: false, status: "ZERO_RESULTS" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ranked = results
      .map((result) => ({ result, score: scoreResult(result, input) }))
      .filter((entry) => Number.isFinite(entry.score))
      .sort((a, b) => b.score - a.score);

    const best = ranked[0]?.result;
    const bestScore = ranked[0]?.score ?? Number.NEGATIVE_INFINITY;
    const location = best?.geometry?.location;

    if (!best || typeof location?.lat !== "number" || typeof location?.lng !== "number") {
      return new Response(
        JSON.stringify({ lat: null, lng: null, exact: false, status: "NO_VALID_RESULT" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        lat: location.lat,
        lng: location.lng,
        exact:
          best.geometry?.location_type === "ROOFTOP" ||
          best.geometry?.location_type === "RANGE_INTERPOLATED",
        locationType: best.geometry?.location_type ?? null,
        formattedAddress: best.formatted_address ?? null,
        score: bestScore,
        queryUsed: selectedQuery,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});