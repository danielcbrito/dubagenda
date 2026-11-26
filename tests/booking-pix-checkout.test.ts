import { describe, test } from 'node:test';
import { deepStrictEqual as equal, throws } from 'node:assert';
import { normalizeBookingPixCheckout } from '../src/lib/booking-pix-checkout';

describe('PIX unificado do agendamento', () => {
  test('Woovi usa reserva e código retornados por create-payment', () => {
    const result = normalizeBookingPixCheckout({ pendingBookingId: 'booking-woovi', wooviPayment: { value: 60, pixQrCode: { encodedImage: 'data:image/png;base64,aW1hZ2U=', payload: 'pix-woovi' } } }, 60, 0);
    equal(result, { pendingBookingId: 'booking-woovi', pixQrCode: 'aW1hZ2U=', pixPayload: 'pix-woovi', provider: 'woovi', correlationId: 'book-booking-woovi', expiresAt: '1970-01-01T00:30:00.000Z', value: 60 });
  });
  test('Mercado Pago preserva o contrato unificado e o rastreamento em woovi_charges', () => {
    const result = normalizeBookingPixCheckout({ pendingBookingId: 'booking-mp', wooviPayment: { value: 40, pixQrCode: { encodedImage: 'bXA=', payload: 'pix-mercadopago' } } }, 40, 0);
    equal(result.pixPayload, 'pix-mercadopago');
    equal(result.pixQrCode, 'bXA=');
    equal(result.correlationId, 'book-booking-mp');
    equal(result.provider, 'woovi');
  });
  test('usa vencimento e valor reais da cobrança, sem acrescentar taxa não cobrada', () => {
    const result = normalizeBookingPixCheckout({ pendingBookingId: 'booking', pendingBooking: { expires_at: '2026-11-26T19:00:00Z' }, wooviPayment: { value: 60, pixQrCode: { payload: 'pix' } } }, 60.9, 0);
    equal(result.expiresAt, '2026-11-26T19:00:00Z');
    equal(result.value, 60);
  });
  test('sem vencimento retorna validade de 30 minutos', () => {
    equal(normalizeBookingPixCheckout({ pendingBookingId: 'booking', wooviPayment: { pixQrCode: { payload: 'pix' } } }, 30, 0).expiresAt, '1970-01-01T00:30:00.000Z');
  });
  test('resposta incompleta não abre checkout sem código ou reserva', () => {
    throws(() => normalizeBookingPixCheckout({ pendingBookingId: 'booking' }, 30));
    throws(() => normalizeBookingPixCheckout({ wooviPayment: { pixQrCode: { payload: 'pix' } } }, 30));
  });
});