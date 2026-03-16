export interface GeocodeAddressParts {
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postalCode?: string | null;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  exact: boolean;
  formattedAddress?: string | null;
  provider?: string | null;
  score?: number | null;
}

export const FRONTEND_GEOCODE_CACHE_PREFIX = "unit-geocode-v6:";
export const LEGACY_GEOCODE_CACHE_PREFIXES = [
  "unit-geocode-v3:",
  "unit-geocode-v4:",
  "unit-geocode-v5:",
] as const;

const GEOCODE_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const BRAZIL_COORDINATE_BOUNDS = {
  minLat: -35.5,
  maxLat: 5.5,
  minLng: -74.5,
  maxLng: -28,
};

export function normalizeLocationText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

export function buildAddressQueryFromParts(parts: GeocodeAddressParts): string | null {
  if (!parts.street || !parts.city) return null;

  return [
    parts.street,
    parts.number,
    parts.neighborhood,
    parts.city,
    parts.state,
    parts.postalCode,
    "Brasil",
  ]
    .filter((part): part is string => Boolean(part && part.length > 0))
    .join(", ");
}

export function hasPreciseAddressParts(parts: GeocodeAddressParts): boolean {
  return Boolean(parts.street && parts.number && parts.city && parts.state);
}

export function formatAddressFromParts(parts: GeocodeAddressParts): string {
  return [parts.street, parts.number, parts.neighborhood, parts.city, parts.state]
    .filter((part): part is string => Boolean(part && part.length > 0))
    .join(", ");
}

export function isValidBrazilCoordinatePair(lat: number, lng: number): boolean {
  return (
    lat >= BRAZIL_COORDINATE_BOUNDS.minLat &&
    lat <= BRAZIL_COORDINATE_BOUNDS.maxLat &&
    lng >= BRAZIL_COORDINATE_BOUNDS.minLng &&
    lng <= BRAZIL_COORDINATE_BOUNDS.maxLng
  );
}

export function resolveStoredCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): { lat: number; lng: number } | null {
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return null;
  }

  if (isValidBrazilCoordinatePair(latitude, longitude)) {
    return { lat: latitude, lng: longitude };
  }

  if (isValidBrazilCoordinatePair(longitude, latitude)) {
    return { lat: longitude, lng: latitude };
  }

  return null;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function readCachedGeocode(addressKey: string): GeocodeResult | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(`${FRONTEND_GEOCODE_CACHE_PREFIX}${addressKey}`);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as GeocodeResult & { savedAt?: number };
    const isExpired = !parsed.savedAt || Date.now() - parsed.savedAt > GEOCODE_CACHE_TTL_MS;

    if (
      isExpired ||
      typeof parsed.lat !== "number" ||
      typeof parsed.lng !== "number" ||
      !isValidBrazilCoordinatePair(parsed.lat, parsed.lng)
    ) {
      window.localStorage.removeItem(`${FRONTEND_GEOCODE_CACHE_PREFIX}${addressKey}`);
      return null;
    }

    return {
      lat: parsed.lat,
      lng: parsed.lng,
      exact: parsed.exact === true,
      formattedAddress: parsed.formattedAddress ?? null,
      provider: parsed.provider ?? null,
      score: typeof parsed.score === "number" ? parsed.score : null,
    };
  } catch {
    return null;
  }
}

export function saveCachedGeocode(addressKey: string, result: GeocodeResult): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      `${FRONTEND_GEOCODE_CACHE_PREFIX}${addressKey}`,
      JSON.stringify({ ...result, savedAt: Date.now() }),
    );
  } catch {
    /* ignore */
  }
}

export function pickResolvedCoordinates(
  stored: { lat: number; lng: number } | null,
  cached: GeocodeResult | null,
): { lat: number; lng: number } | null {
  if (cached?.exact) {
    return { lat: cached.lat, lng: cached.lng };
  }

  if (stored) {
    return stored;
  }

  if (cached) {
    return { lat: cached.lat, lng: cached.lng };
  }

  return null;
}

export function shouldPreferGeocodedCoordinates(
  stored: { lat: number; lng: number } | null,
  geocoded: GeocodeResult,
  minimumDistanceKm = 0.05,
): boolean {
  if (!stored) return true;
  if (!geocoded.exact) return false;

  return haversineKm(stored.lat, stored.lng, geocoded.lat, geocoded.lng) > minimumDistanceKm;
}

export function clearLegacyGeocodeCaches(discoverCacheKeys: string[] = []): void {
  if (typeof window === "undefined") return;

  try {
    discoverCacheKeys.forEach((key) => window.sessionStorage.removeItem(key));

    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && LEGACY_GEOCODE_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    /* ignore */
  }
}

export async function geocodeAddressFromParts(
  parts: GeocodeAddressParts,
): Promise<GeocodeResult | null> {
  const address = buildAddressQueryFromParts(parts);
  if (!address) return null;

  try {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const url = `https://${projectId}.supabase.co/functions/v1/geocode-address`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({
        address,
        components: {
          rua: parts.street,
          numero: parts.number,
          bairro: parts.neighborhood,
          cidade: parts.city,
          estado: parts.state,
          cep: parts.postalCode,
        },
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (typeof data.lat !== "number" || typeof data.lng !== "number") return null;
    if (!isValidBrazilCoordinatePair(data.lat, data.lng)) return null;

    return {
      lat: data.lat,
      lng: data.lng,
      exact: data.exact === true,
      formattedAddress: data.formattedAddress ?? null,
      provider: data.provider ?? null,
      score: typeof data.score === "number" ? data.score : null,
    };
  } catch {
    return null;
  }
}
