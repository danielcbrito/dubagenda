import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { resolveBookingPixReceiver } from '../_shared/booking-payment-receiver.ts';
import { createWooviCharge } from '../_shared/woovi-charge.ts';
import { BookingPixAccountError } from '../_shared/booking-payment-route.ts';

function mockAdmin(status = 'approved', provider = 'mercadopago') {
  const reads: Array<{ table: string; filters: Record<string, unknown>; operation: string }> = [];
  const writes: Array<{ table: string; operation: string; values: Record<string, unknown> }> = [];
  const admin: any = {
    auth: { admin: { getUserById: () => Promise.resolve({ data: { user: { email: 'test@example.com' } } }) } },
    from(table: string) {
      const entry = { table, filters: {} as Record<string, unknown>, operation: 'select' };
      reads.push(entry);
      const result = () => {
        if (entry.operation !== 'select') return { data: null, error: null };
        const rows: Record<string, unknown> = {
          barbeiros: entry.filters.tenant_id === 'tenant-test' ? { id: 'barber-test' } : null,
          barber_payment_accounts: { status, provider },
          barber_mp_credentials: { access_token: 'fake-seller-token', refresh_token: 'fake-refresh', expires_at: '2099-01-01T00:00:00Z' },
          barber_payment_credentials: { app_id: 'fake-own-woovi' },
          woovi_charges: { value_centavos: 2500, user_id: 'client-test', barbeiro_id: 'barber-test', br_code: null },
        };
        return { data: rows[table], error: null };
      };
      const query: any = {
        select() { return query; },
        eq(field: string, value: unknown) { entry.filters[field] = value; return query; },
        is(field: string, value: unknown) { entry.filters[field] = value; return query; },
        upsert(values: Record<string, unknown>) { entry.operation = 'upsert'; writes.push({ table, operation: 'upsert', values }); return query; },
        update(values: Record<string, unknown>) { entry.operation = 'update'; writes.push({ table, operation: 'update', values }); return query; },
        maybeSingle() { return Promise.resolve(result()); },
        single() { return Promise.resolve(result()); },
        then(resolve: (value: unknown) => unknown) { return Promise.resolve(result()).then(resolve); },
      };
      return query;
    },
  };
  return { admin, reads, writes };
}

Deno.test('approved Mercado Pago does not require Woovi credentials and stays tenant-scoped', async () => {
  const { admin, reads } = mockAdmin();
  const receiver = await resolveBookingPixReceiver(admin, 'barber-test', 'tenant-test');
  assertEquals(receiver.provider, 'mercadopago');
  assertEquals(reads.some(read => read.table === 'barber_payment_credentials'), false);
  assertEquals(reads.find(read => read.table === 'barber_payment_accounts')?.filters,
    { barbeiro_id: 'barber-test', tenant_id: 'tenant-test' });
});

Deno.test('another tenant cannot resolve the professional account', async () => {
  const { admin, reads } = mockAdmin();
  await assertRejects(() => resolveBookingPixReceiver(admin, 'barber-test', 'other-tenant'), BookingPixAccountError);
  assertEquals(reads.some(read => read.table === 'barber_mp_credentials'), false);
});

Deno.test('pending payment account fails before reservations or bank calls', async () => {
  const { admin, writes } = mockAdmin('pending');
  await assertRejects(() => resolveBookingPixReceiver(admin, 'barber-test', 'tenant-test'), BookingPixAccountError);
  assertEquals(writes.length, 0);
});

Deno.test('approved Woovi resolves its own credential', async () => {
  const { admin, reads } = mockAdmin('approved', 'woovi');
  const receiver = await resolveBookingPixReceiver(admin, 'barber-test', 'tenant-test');
  assertEquals(receiver.provider, 'woovi');
  assertEquals(receiver.credential, 'fake-own-woovi');
  assertEquals(reads.some(read => read.table === 'barber_mp_credentials'), false);
});

Deno.test('Mercado Pago booking generates unified QR using only the seller account and saves tracking', async () => {
  const { admin, writes } = mockAdmin();
  const receiver = await resolveBookingPixReceiver(admin, 'barber-test', 'tenant-test');
  const originalFetch = globalThis.fetch;
  let bankCalls = 0;
  globalThis.fetch = async (url, options) => {
    assertEquals(String(url), 'https://api.mercadopago.com/v1/payments');
    assertEquals(new Headers(options?.headers).get('Authorization'), 'Bearer fake-seller-token');
    assertEquals(new Headers(options?.headers).get('X-Idempotency-Key'), 'pix-book-pending-test');
    const body = JSON.parse(String(options?.body));
    assertEquals(body.transaction_amount, 25);
    assertEquals(body.external_reference, 'book-pending-test');
    bankCalls++;
    return new Response(JSON.stringify({ id: 123, status: 'pending', point_of_interaction: {
      transaction_data: { qr_code: 'fake-pix-payload', qr_code_base64: 'ZmFrZQ==' },
    } }), { headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const charge = await createWooviCharge(admin, { barberId: 'barber-test', tenantId: 'tenant-test',
      receiver, userId: 'client-test', correlationID: 'book-pending-test', amount: 25,
      comment: 'Test booking', target: { pending_booking_id: 'pending-test' } });
    assertEquals(charge.pixQrCode, { encodedImage: 'data:image/png;base64,ZmFrZQ==', payload: 'fake-pix-payload' });
    assertEquals(charge.id, 'book-pending-test');
    assertEquals(bankCalls, 1);
    assertEquals(writes.find(write => write.operation === 'update')?.values.raw_response,
      { provider: 'mercadopago', id: 123, status: 'pending' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});