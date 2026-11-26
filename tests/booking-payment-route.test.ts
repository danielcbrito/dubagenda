import { test } from 'node:test';
import { strictEqual as equal } from 'node:assert';
import { selectBookingPixProvider } from '../supabase/functions/_shared/booking-payment-route';

test('approved Mercado Pago receives PIX without any Woovi credential', () => {
  equal(selectBookingPixProvider({ status: 'approved', provider: 'mercadopago' }, true, false), 'mercadopago');
});
test('approved Woovi receives PIX using its own credential', () => {
  equal(selectBookingPixProvider({ status: 'approved', provider: 'woovi' }, false, true), 'woovi');
});
test('pending and rejected accounts never receive PIX even with stored credentials', () => {
  equal(selectBookingPixProvider({ status: 'pending', provider: 'mercadopago' }, true, true), null);
  equal(selectBookingPixProvider({ status: 'rejected', provider: 'woovi' }, true, true), null);
});
test('missing Mercado Pago token never falls back to Woovi or master account', () => {
  equal(selectBookingPixProvider({ status: 'approved', provider: 'mercadopago' }, false, true), null);
  equal(selectBookingPixProvider(null, true, true), null);
});