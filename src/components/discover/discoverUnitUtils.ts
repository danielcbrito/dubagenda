export function normalizeDiscoverText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

export function getDiscoverUnitDisplayName(
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
