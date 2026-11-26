interface UnifiedBookingPixResponse {
  pendingBookingId?: string;
  pendingBooking?: { expires_at?: string; preco?: number };
  wooviPayment?: {
    value?: number;
    pixQrCode?: { encodedImage?: string; payload?: string };
  };
}

/** Both gateways share woovi_charges tracking in the unified payment contract. */
export function normalizeBookingPixCheckout(
  response: UnifiedBookingPixResponse | null | undefined,
  bookingValue: number,
  now = Date.now(),
) {
  const pendingBookingId = response?.pendingBookingId;
  const qr = response?.wooviPayment?.pixQrCode;
  if (!pendingBookingId || !qr?.payload?.trim()) {
    throw new Error('Não foi possível gerar o PIX. A resposta não contém a reserva ou o código de pagamento.');
  }
  const value = response?.wooviPayment?.value ?? response?.pendingBooking?.preco ?? bookingValue;
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('O valor da cobrança PIX é inválido.');
  }
  const returnedExpiry = response?.pendingBooking?.expires_at;
  return {
    pixQrCode: qr.encodedImage?.replace(/^data:image\/png;base64,/, '') ?? '',
    pixPayload: qr.payload,
    pendingBookingId,
    provider: 'woovi' as const,
    correlationId: `book-${pendingBookingId}`,
    expiresAt: returnedExpiry && Number.isFinite(Date.parse(returnedExpiry))
      ? returnedExpiry
      : new Date(now + 30 * 60 * 1000).toISOString(),
    value,
  };
}