export type BookingPixProvider = 'mercadopago' | 'woovi';

/** Never fall back to the platform or to a different provider's account. */
export function selectBookingPixProvider(
  account: { status: string; provider: string } | null,
  hasMercadoPagoToken: boolean,
  hasWooviCredential: boolean,
): BookingPixProvider | null {
  if (account?.status !== 'approved') return null;
  if (account.provider === 'mercadopago' && hasMercadoPagoToken) return 'mercadopago';
  if (account.provider === 'woovi' && hasWooviCredential) return 'woovi';
  return null;
}

export class BookingPixAccountError extends Error {
  readonly code = 'BARBER_PIX_ACCOUNT_UNAVAILABLE';
}