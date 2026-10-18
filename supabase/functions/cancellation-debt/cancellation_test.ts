import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { calculateCancellationFee, verifiedDebtPayment } from '../_shared/cancellation-fee.ts';
import { confirmDebtPayment } from '../_shared/debt-payment.ts';

Deno.test('taxa percentual 20% de 50 resulta em 10', () => {
  assertEquals(calculateCancellationFee({ habilitado: true, tipo: 'porcentagem', valor: 20, horas_antecedencia: 0 }, 50, 0, 0), 10);
});
Deno.test('taxa fixa de 15 permanece 15', () => {
  assertEquals(calculateCancellationFee({ habilitado: true, tipo: 'fixo', valor: 15, horas_antecedencia: 0 }, 50, 0, 0), 15);
});
Deno.test('PIX pendente não desbloqueia', () => {
  assertEquals(verifiedDebtPayment({ correlationID: 'debt-1', status: 'PENDING', value: 1500 }, 'debt-1', 1500), false);
});
Deno.test('consulta autorizada do gateway precede quitação', async () => {
  const originalFetch = globalThis.fetch;
  let settled = false;
  globalThis.fetch = (() => Promise.resolve(new Response(JSON.stringify({ charge: { correlationID: 'debt-1', status: 'COMPLETED', value: 1500 } }), { status: 200 }))) as typeof fetch;
  try {
    const admin = { rpc: (_name: string, args: { p_cents: number }) => { settled = args.p_cents === 1500; return Promise.resolve({ error: null }); } };
    assertEquals(await confirmDebtPayment(admin, { correlation_id: 'debt-1', value_centavos: 1500 }, 'test-only'), true);
    assertEquals(settled, true);
  } finally { globalThis.fetch = originalFetch; }
});