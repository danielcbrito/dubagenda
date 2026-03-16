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
  unitName: string | null | undefined
): string {
  const words = brandName.trim().split(/\s+/);
  const shortBrandName = words.length <= 1
    ? brandName.trim()
    : (() => {
        const firstNormalized = normalizeDiscoverText(words[0]);
        if (GENERIC_PREFIXES.includes(firstNormalized)) {
          const rest = words.slice(1).join(" ");
          return rest || brandName.trim();
        }
        return brandName.trim();
      })();

  const cleanUnitName = unitName?.trim();
  const normalizedUnit = normalizeDiscoverText(cleanUnitName);
  const normalizedBrand = normalizeDiscoverText(brandName);

  if (!cleanUnitName || !normalizedUnit || normalizedUnit === normalizedBrand) {
    return shortBrandName;
  }

  return `${shortBrandName} • ${cleanUnitName}`;
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

export function getDuplicateMarkerPixelOffset(
  index: number,
  total: number
): { x: number; y: number } {
  if (total <= 1) return { x: 0, y: 0 };

  const radius = total === 2 ? 10 : 12;
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;

  return {
    x: Math.round(Math.cos(angle) * radius),
    y: Math.round(Math.sin(angle) * radius),
  };
}
