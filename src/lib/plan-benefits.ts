/**
 * Parse and clean plan benefits from beneficios_json.
 *
 * - Accepts an array, a JSON string, or any other value.
 * - Returns only non-empty, non-blank strings.
 * - Empty or blank benefit strings are filtered out so they never render.
 */
export function parsePlanBenefits(beneficios_json: unknown): string[] {
  const raw: unknown[] = Array.isArray(beneficios_json)
    ? beneficios_json
    : typeof beneficios_json === "string"
    ? (() => {
        try {
          return JSON.parse(beneficios_json || "[]");
        } catch {
          return [];
        }
      })()
    : [];

  return raw.filter(
    (b): b is string => typeof b === "string" && b.trim().length > 0
  );
}
