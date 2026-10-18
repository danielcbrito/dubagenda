import { test } from 'node:test';
import { strictEqual, throws, deepStrictEqual } from 'node:assert';
import { calculateCancellationFee, verifiedDebtPayment } from '../supabase/functions/_shared/cancellation-fee';
import { readPendingDebts } from '../src/lib/cancellation-debt';
const config = { habilitado: true, tipo: 'porcentagem' as const, valor: 20, horas_antecedencia: 0 };
test('20% de R$ 50,00 são R$ 10,00', () => strictEqual(calculateCancellationFee(config, 50, 0, 0), 10));
test('taxa fixa R$ 15,00 independe do serviço', () => strictEqual(calculateCancellationFee({ ...config, tipo: 'fixo', valor: 15 }, 50, 0, 0), 15));
test('taxa desativada não gera débito', () => strictEqual(calculateCancellationFee({ ...config, habilitado: false }, 50, 0, 0), 0));
test('zero horas cobra sem janela', () => strictEqual(calculateCancellationFee(config, 50, 86400000, 0), 10));
test('fora da antecedência positiva não cobra', () => strictEqual(calculateCancellationFee({ ...config, horas_antecedencia: 2 }, 50, 10800000, 0), 0));
test('no limite de antecedência cobra', () => strictEqual(calculateCancellationFee({ ...config, horas_antecedencia: 2 }, 50, 7200000, 0), 10));
test('valor inválido não produz cobrança', () => throws(() => calculateCancellationFee({ ...config, valor: -1 }, 50, 0, 0)));
test('confirmação deve corresponder à cobrança e ao valor', () => {
  strictEqual(verifiedDebtPayment({ correlationID: 'debt-1', status: 'COMPLETED', value: 1500 }, 'debt-1', 1500), true);
  strictEqual(verifiedDebtPayment({ correlationID: 'other', status: 'COMPLETED', value: 1500 }, 'debt-1', 1500), false);
  strictEqual(verifiedDebtPayment({ correlationID: 'debt-1', status: 'COMPLETED', value: 1400 }, 'debt-1', 1500), false);
  strictEqual(verifiedDebtPayment({ correlationID: 'debt-1', status: 'PENDING', value: 1500 }, 'debt-1', 1500), false);
});
test('somente débito próprio pendente bloqueia', () => {
  const row = { row_id: 1, tenant_id: 'tenant', debito: { id: 'd', cliente_id: 'u', barbeiro_id: 'b', agendamento_id: 'a', valor_taxa: 15, status: 'pendente' } };
  deepStrictEqual(readPendingDebts([row], 'u'), [row]);
  deepStrictEqual(readPendingDebts([row], 'other'), []);
  deepStrictEqual(readPendingDebts([{ ...row, debito: { ...row.debito, status: 'pago' } }], 'u'), []);
});