/** Global client PIX switch; barber eligibility and configuration still apply. */
export const CLIENT_PIX_ENABLED = true;

/** E-mail do único cliente autorizado a pagar via PIX enquanto a liberação global estiver restrita. */
export const PIX_ALLOWED_EMAIL = 'danielcbrito74@gmail.com';

/** ID do único cliente autorizado a pagar via PIX (fallback quando getUser não retorna o e-mail). */
export const PIX_ALLOWED_USER_ID = '5d574ff2-4b2f-49d4-b260-1516a389cd80';

export function isClientPixAllowed(email: string | null, userId: string | null): boolean {
  return CLIENT_PIX_ENABLED && Boolean(email || userId);
}

/** Only approved supported accounts or an existing Woovi key enable booking PIX. */
export function canBarberReceiveBookingPix(
  wooviKey: string | null | undefined,
  accounts: ReadonlyArray<{ status: string; provider: string }>,
): boolean {
  return Boolean(wooviKey?.trim()) || accounts.some(
    account => account.status === 'approved' && ['mercadopago', 'woovi'].includes(account.provider),
  );
}

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