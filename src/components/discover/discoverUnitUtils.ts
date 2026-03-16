export function normalizeDiscoverText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

/** Words to strip from brand name for short map pin labels */
const GENERIC_PREFIXES = ["barbearia", "barbershop", "barber", "salao", "studio", "estudio"];

export function getDiscoverUnitDisplayName(
  brandName: string,
  _unitName: string | null | undefined
): string {
  const words = brandName.trim().split(/\s+/);
  if (words.length <= 1) return brandName.trim();

  // If first word is a generic prefix like "Barbearia", return the rest
  const firstNormalized = normalizeDiscoverText(words[0]);
  if (GENERIC_PREFIXES.includes(firstNormalized)) {
    const rest = words.slice(1).join(" ");
    return rest || brandName.trim();
  }

  // Otherwise return the full brand name
  return brandName.trim();
}

/** Full display name with unit detail — used in cards */
export function getDiscoverUnitFullName(
  brandName: string,
  unitName: string | null | undefined
): string {
  if (!unitName?.trim()) return brandName;

  const cleanUnitName = unitName.trim();
  if (!cleanUnitName) return brandName;

  const normalizedBrand = normalizeDiscoverText(brandName);
  const normalizedUnit = normalizeDiscoverText(cleanUnitName);

  if (!normalizedUnit || normalizedUnit === normalizedBrand) {
    return brandName;
  }

  return `${brandName} — ${cleanUnitName}`;
}

export function getCoordinateGroupKey(lat: number, lng: number): string {
  return `${lat.toFixed(6)}:${lng.toFixed(6)}`;
}

export function offsetDuplicateCoordinate(
  lat: number,
  lng: number,
  index: number,
  total: number
): { lat: number; lng: number } {
  if (total <= 1) return { lat, lng };

  const radius = 0.00022 + Math.min(total, 6) * 0.00003;
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;

  return {
    lat: lat + Math.sin(angle) * radius,
    lng: lng + Math.cos(angle) * radius,
  };
}
