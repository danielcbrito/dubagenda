export interface BarberPaymentOptions {
  pix: boolean;
  barbearia: boolean;
}

export type BookingPaymentMethod = 'cash' | 'pix' | 'wallet' | 'card';

export function parseBarberPaymentOptions(value?: string | null): BarberPaymentOptions {
  const defaults = { pix: true, barbearia: true };
  if (!value) return defaults;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return defaults;
    const config = parsed as Record<string, unknown>;
    return {
      pix: typeof config.pix === 'boolean' ? config.pix : true,
      barbearia: typeof config.barbearia === 'boolean' ? config.barbearia : true,
    };
  } catch {
    return defaults;
  }
}

export function resolveBookingPaymentMethod(
  selected: BookingPaymentMethod | null,
  available: Record<BookingPaymentMethod, boolean>,
): BookingPaymentMethod | null {
  if (selected && available[selected]) return selected;
  return (['pix', 'cash', 'wallet', 'card'] as const).find(method => available[method]) ?? null;
}