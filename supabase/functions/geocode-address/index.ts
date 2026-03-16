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

type NominatimResult = {
  lat: string;
  lon: string;
  display_name?: string;
  address?: {
    road?: string;
    house_number?: string;
    suburb?: string;
    neighbourhood?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    postcode?: string;
  };
};

type ArcGisCandidate = {
  address?: string;
  score?: number;
  location?: {
    x?: number;
    y?: number;
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

function scoreGoogleResult(result: GoogleGeocodeResult, input: GeocodeInput) {
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

function scoreNominatimResult(result: NominatimResult, input: GeocodeInput) {
  const lat = Number(result.lat);
  const lng = Number(result.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isWithinBrazil(lat, lng)) {
    return Number.NEGATIVE_INFINITY;
  }

  const components = input.components ?? {};
  const address = result.address ?? {};
  const city = address.city ?? address.town ?? address.village ?? null;
  const neighborhood = address.suburb ?? address.neighbourhood ?? null;

  let score = 12;

  if (components.rua) {
    score += matchesText(address.road, components.rua) ? 22 : -10;
  }

  if (components.numero) {
    score += digitsOnly(address.house_number) === digitsOnly(components.numero) ? 18 : -6;
  }

  if (components.bairro && matchesText(neighborhood, components.bairro)) {
    score += 10;
  }

  if (components.cidade) {
    score += matchesText(city, components.cidade) ? 16 : -18;
  }

  if (components.estado) {
    score += matchesText(address.state, components.estado) ? 8 : -10;
  }

  if (components.cep) {
    score += digitsOnly(address.postcode) === digitsOnly(components.cep) ? 16 : 0;
  }

  if (input.address && matchesText(result.display_name, input.address)) {
    score += 10;
  }

  return score;
}

function isExactArcGisCandidate(candidate: ArcGisCandidate, input: GeocodeInput) {
  const components = input.components ?? {};
  const address = candidate.address ?? "";

  const streetMatches = !components.rua || matchesText(address, components.rua);
  const numberMatches =
    !components.numero || digitsOnly(address).includes(digitsOnly(components.numero));
  const cityMatches = !components.cidade || matchesText(address, components.cidade);
  const postalCodeMatches =
    !components.cep || digitsOnly(address).includes(digitsOnly(components.cep));

  return Boolean(
    (candidate.score ?? 0) >= 95 &&
      streetMatches &&
      numberMatches &&
      cityMatches &&
      postalCodeMatches,
  );
}

function scoreArcGisCandidate(candidate: ArcGisCandidate, input: GeocodeInput) {
  const lat = candidate.location?.y;
  const lng = candidate.location?.x;

  if (typeof lat !== "number" || typeof lng !== "number" || !isWithinBrazil(lat, lng)) {
    return Number.NEGATIVE_INFINITY;
  }

  const components = input.components ?? {};
  const address = candidate.address ?? "";
  let score = candidate.score ?? 0;

  if (components.rua) {
    score += matchesText(address, components.rua) ? 16 : -12;
  }

  if (components.numero) {
    score += digitsOnly(address).includes(digitsOnly(components.numero)) ? 22 : -8;
  }

  if (components.bairro) {
    score += matchesText(address, components.bairro) ? 10 : -4;
  }

  if (components.cidade) {
    score += matchesText(address, components.cidade) ? 16 : -18;
  }

  if (components.estado) {
    score += matchesText(address, components.estado) ? 8 : -6;
  }

  if (components.cep) {
    score += digitsOnly(address).includes(digitsOnly(components.cep)) ? 16 : 0;
  }

  if (input.address && matchesText(address, input.address)) {
    score += 12;
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

async function fetchGoogleResults(address: string, apiKey: string, googleComponents: string) {
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

  return {
    status: payload.status as string,
    results: Array.isArray(payload.results)
      ? (payload.results as GoogleGeocodeResult[])
      : [],
  };
}

async function fetchNominatimResults(address: string) {
  const params = new URLSearchParams({
    q: address,
    format: "jsonv2",
    limit: "5",
    countrycodes: "br",
    addressdetails: "1",
  });

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "DubAgenda/1.0",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Nominatim error: ${response.status}`);
  }

  const payload = await response.json();
  return Array.isArray(payload) ? (payload as NominatimResult[]) : [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
    const input = (await req.json()) as GeocodeInput;

    if (!input.address || typeof input.address !== "string") {
      return new Response(
        JSON.stringify({ error: "address is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const candidates = buildAddressCandidates(input);
    const googleComponents = buildGoogleComponents(input);

    let googleStatus: string | null = null;
    let bestGoogle:
      | { result: GoogleGeocodeResult; score: number; queryUsed: string }
      | null = null;

    if (GOOGLE_MAPS_API_KEY) {
      for (const candidate of candidates) {
        try {
          const { status, results } = await fetchGoogleResults(
            candidate,
            GOOGLE_MAPS_API_KEY,
            googleComponents,
          );
          googleStatus = status;

          const ranked = results
            .map((result) => ({ result, score: scoreGoogleResult(result, input) }))
            .filter((entry) => Number.isFinite(entry.score))
            .sort((a, b) => b.score - a.score);

          if (ranked[0]) {
            bestGoogle = {
              result: ranked[0].result,
              score: ranked[0].score,
              queryUsed: candidate,
            };
            break;
          }
        } catch {
          googleStatus = "REQUEST_FAILED";
        }
      }
    }

    if (bestGoogle?.result.geometry?.location) {
      return new Response(
        JSON.stringify({
          lat: bestGoogle.result.geometry.location.lat ?? null,
          lng: bestGoogle.result.geometry.location.lng ?? null,
          exact:
            bestGoogle.result.geometry.location_type === "ROOFTOP" ||
            bestGoogle.result.geometry.location_type === "RANGE_INTERPOLATED",
          locationType: bestGoogle.result.geometry.location_type ?? null,
          formattedAddress: bestGoogle.result.formatted_address ?? null,
          score: bestGoogle.score,
          queryUsed: bestGoogle.queryUsed,
          provider: "google",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let bestNominatim:
      | { result: NominatimResult; score: number; queryUsed: string }
      | null = null;

    for (const candidate of candidates) {
      try {
        const results = await fetchNominatimResults(candidate);
        const ranked = results
          .map((result) => ({ result, score: scoreNominatimResult(result, input) }))
          .filter((entry) => Number.isFinite(entry.score))
          .sort((a, b) => b.score - a.score);

        if (ranked[0]) {
          bestNominatim = {
            result: ranked[0].result,
            score: ranked[0].score,
            queryUsed: candidate,
          };
          break;
        }
      } catch {
        /* keep trying next candidate */
      }
    }

    if (!bestNominatim) {
      return new Response(
        JSON.stringify({
          lat: null,
          lng: null,
          exact: false,
          status: googleStatus ?? "ZERO_RESULTS",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        lat: Number(bestNominatim.result.lat),
        lng: Number(bestNominatim.result.lon),
        exact: Boolean(
          bestNominatim.result.address?.road &&
            bestNominatim.result.address?.house_number,
        ),
        locationType: "NOMINATIM",
        formattedAddress: bestNominatim.result.display_name ?? null,
        score: bestNominatim.score,
        queryUsed: bestNominatim.queryUsed,
        provider: "nominatim",
        fallbackReason: googleStatus,
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