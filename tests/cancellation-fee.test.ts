import { test } from 'node:test';
import { strictEqual, throws, deepStrictEqual } from 'node:assert';
import { calculateCancellationFee, resolveBaseCancellationPrice, verifiedDebtPayment } from '../supabase/functions/_shared/cancellation-fee';
import { applyDebtRelease, readPendingDebts } from '../src/lib/cancellation-debt';
const config = { habilitado: true, tipo: 'porcentagem' as const, valor: 20, horas_antecedencia: 0 };
test('20% de R$ 50,00 são R$ 10,00', () => strictEqual(calculateCancellationFee(config, 50, 0, 0), 10));
test('taxa fixa R$ 15,00 independe do serviço', () => strictEqual(calculateCancellationFee({ ...config, tipo: 'fixo', valor: 15 }, 50, 0, 0), 15));
test('taxa desativada não gera débito', () => strictEqual(calculateCancellationFee({ ...config, habilitado: false }, 50, 0, 0), 0));
test('zero horas cobra sem janela', () => strictEqual(calculateCancellationFee(config, 50, 86400000, 0), 10));
test('fora da antecedência positiva não cobra', () => strictEqual(calculateCancellationFee({ ...config, horas_antecedencia: 2 }, 50, 10800000, 0), 0));
test('no limite de antecedência cobra', () => strictEqual(calculateCancellationFee({ ...config, horas_antecedencia: 2 }, 50, 7200000, 0), 10));
test('valor inválido não produz cobrança', () => throws(() => calculateCancellationFee({ ...config, valor: -1 }, 50, 0, 0)));

// Testes para agendamentos de plano / cortesia / preço zero
test('agendamento com preco > 0 usa o preco do agendamento', () => {
  strictEqual(resolveBaseCancellationPrice(50, 60), 50);
});
test('agendamento de plano (preco = 0) faz fallback para o preco do servico de catalogo', () => {
  strictEqual(resolveBaseCancellationPrice(0, 50), 50);
  strictEqual(resolveBaseCancellationPrice(null, 50), 50);
  strictEqual(resolveBaseCancellationPrice(undefined, 50), 50);
});
test('taxa de 10% para cliente de plano VIP em servico de R$ 50,00 calcula R$ 5,00 de taxa', () => {
  const vipConfig = { habilitado: true, tipo: 'porcentagem' as const, valor: 10, horas_antecedencia: 0 };
  const basePrice = resolveBaseCancellationPrice(0, 50);
  strictEqual(basePrice, 50);
  strictEqual(calculateCancellationFee(vipConfig, basePrice, 0, 0), 5);
});
test('taxa fixa de R$ 15,00 para agendamento de plano (preco = 0) mantem R$ 15,00', () => {
  const fixedConfig = { habilitado: true, tipo: 'fixo' as const, valor: 15, horas_antecedencia: 0 };
  const basePrice = resolveBaseCancellationPrice(0, 50);
  strictEqual(calculateCancellationFee(fixedConfig, basePrice, 0, 0), 15);
});

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

const debt = { row_id: 1, tenant_id: 'tenant', debito: { id: 'd', cliente_id: 'u', barbeiro_id: 'b', agendamento_id: 'a', valor_taxa: 15, status: 'pendente' } };
const releaseEvent = (status: string) => ({ eventType: 'UPDATE', new: { id: 1, tenant_id: 'tenant', categoria: 'debitos_cliente', chave: 'debito_cancelamento_u', valor: JSON.stringify({ ...debt.debito, status }) } });
for (const status of ['pago', 'dispensado', 'liberado_manual']) {
  test(`${status} libera imediatamente o débito correspondente`, () => {
    deepStrictEqual(applyDebtRelease([debt], releaseEvent(status), 'u'), []);
    deepStrictEqual(readPendingDebts([{ ...debt, debito: { ...debt.debito, status } }], 'u'), []);
  });
}
test('DELETE com apenas chave primária remove só o débito excluído', () => {
  const other = { ...debt, row_id: 2, tenant_id: 'other-tenant' };
  deepStrictEqual(applyDebtRelease([debt, other], { eventType: 'DELETE', old: { id: 1 } }, 'u'), [other]);
  deepStrictEqual(applyDebtRelease([debt], { eventType: 'DELETE', old: { id: 3 } }, 'u'), [debt]);
});
test('liberação de outro tenant ou cliente não remove dívida própria', () => {
  const event = releaseEvent('liberado_manual');
  deepStrictEqual(applyDebtRelease([debt], { ...event, new: { ...event.new, tenant_id: 'other' } }, 'u'), [debt]);
  deepStrictEqual(applyDebtRelease([debt], { ...event, new: { ...event.new, valor: JSON.stringify({ ...debt.debito, cliente_id: 'other', status: 'dispensado' }) } }, 'u'), [debt]);
});
test('evento inválido e status pendente não desbloqueiam', () => {
  const event = releaseEvent('pendente');
  deepStrictEqual(applyDebtRelease([debt], event, 'u'), [debt]);
  deepStrictEqual(applyDebtRelease([debt], { ...event, new: { ...event.new, valor: '{invalid' } }, 'u'), [debt]);
});
test('liberação mantém bloqueio por outra dívida pendente', () => {
  const other = { ...debt, row_id: 2, tenant_id: 'other' };
  deepStrictEqual(applyDebtRelease([debt, other], releaseEvent('dispensado'), 'u'), [other]);
});

test('cliente VIP (661836a7-a45e-4255-9b37-ec137225a706) e bloqueado quando debito esta pendente', () => {
  const vipUserId = '661836a7-a45e-4255-9b37-ec137225a706';
  const vipDebt = {
    row_id: 101,
    tenant_id: '5e825363-70ff-4abe-9143-9e87758437e7',
    debito: {
      id: 'debt-vip-1',
      cliente_id: vipUserId,
      barbeiro_id: '1cf7a87c-d4a4-4a63-8e2c-75a2cb5fb770',
      agendamento_id: 'apt-vip-1',
      valor_taxa: 5,
      status: 'pendente'
    }
  };
  const pending = readPendingDebts([vipDebt], vipUserId);
  strictEqual(pending.length, 1);
  strictEqual(pending[0].debito.valor_taxa, 5);

  // Quando o debito e liberado ou pago, o cliente e destravado
  const unblockedPago = applyDebtRelease([vipDebt], {
    eventType: 'UPDATE',
    new: {
      id: 101,
      tenant_id: '5e825363-70ff-4abe-9143-9e87758437e7',
      categoria: 'debitos_cliente',
      chave: `debito_cancelamento_${vipUserId}`,
      valor: JSON.stringify({ ...vipDebt.debito, status: 'pago' })
    }
  }, vipUserId);
  deepStrictEqual(unblockedPago, []);

  const unblockedDispensado = applyDebtRelease([vipDebt], {
    eventType: 'UPDATE',
    new: {
      id: 101,
      tenant_id: '5e825363-70ff-4abe-9143-9e87758437e7',
      categoria: 'debitos_cliente',
      chave: `debito_cancelamento_${vipUserId}`,
      valor: JSON.stringify({ ...vipDebt.debito, status: 'dispensado' })
    }
  }, vipUserId);
  deepStrictEqual(unblockedDispensado, []);
});

import { isFreeCancellation, resolveCancellationFinancials } from '../supabase/functions/_shared/cancellation-fee';
import { getPendingDebtTotal, getPendingDebtItems } from '../src/lib/cancellation-debt';

// Testes para a nova especificação:
test('regra do sistema: cancelamento gratuito com mais de 2 horas de antecedência', () => {
  const now = 1000000000;
  const startMoreThan2h = now + (2.5 * 3600000); // 2h30min antes
  strictEqual(isFreeCancellation(startMoreThan2h, now), true);

  const barbConfig = { habilitado: true, tipo: 'porcentagem' as const, valor: 20 };
  // Cancelamento com mais de 2h é gratuito (taxa = 0)
  strictEqual(calculateCancellationFee(barbConfig, 50, startMoreThan2h, now, false), 0);
});

test('regra do sistema: cancelamento faltando menos de 2 horas aplica a taxa configurada', () => {
  const now = 1000000000;
  const startLessThan2h = now + (1.5 * 3600000); // 1h30min antes
  strictEqual(isFreeCancellation(startLessThan2h, now), false);

  const barbConfigPercent = { habilitado: true, tipo: 'porcentagem' as const, valor: 20 };
  strictEqual(calculateCancellationFee(barbConfigPercent, 50, startLessThan2h, now, false), 10);

  const barbConfigFixed = { habilitado: true, tipo: 'fixo' as const, valor: 15 };
  strictEqual(calculateCancellationFee(barbConfigFixed, 50, startLessThan2h, now, false), 15);
});

test('regra do sistema: falta (no-show) sempre cobra a taxa mesmo se o agendamento foi no futuro ou passado', () => {
  const now = 1000000000;
  const barbConfig = { habilitado: true, tipo: 'porcentagem' as const, valor: 30 };
  // No-show flag isNoShow = true
  strictEqual(calculateCancellationFee(barbConfig, 50, now + 10000000, now, true), 15);
});

test('fluxo Pix: cancelamento com menos de 2h desconta taxa do reembolso e nao cria divida', () => {
  const now = 1000000000;
  const startLessThan2h = now + (1 * 3600000);
  const barbConfig = { habilitado: true, tipo: 'porcentagem' as const, valor: 20 }; // 20% de 50 = 10

  const res = resolveCancellationFinancials({
    config: barbConfig,
    basePrice: 50,
    paidAmount: 50,
    isPrepaid: true,
    appointmentStartMs: startLessThan2h,
    nowMs: now,
    isNoShow: false,
  });

  strictEqual(res.freeCancellation, false);
  strictEqual(res.feeAmount, 10);
  strictEqual(res.refundAmount, 40); // 50 - 10 = 40
  strictEqual(res.debtAmount, 0); // Sem dívida pendente, taxa abatida do estorno!
});

test('fluxo Pix: cancelamento gratuito reembolsa 100% do valor pago', () => {
  const now = 1000000000;
  const startMoreThan2h = now + (3 * 3600000);
  const barbConfig = { habilitado: true, tipo: 'porcentagem' as const, valor: 20 };

  const res = resolveCancellationFinancials({
    config: barbConfig,
    basePrice: 50,
    paidAmount: 50,
    isPrepaid: true,
    appointmentStartMs: startMoreThan2h,
    nowMs: now,
    isNoShow: false,
  });

  strictEqual(res.freeCancellation, true);
  strictEqual(res.feeAmount, 0);
  strictEqual(res.refundAmount, 50);
  strictEqual(res.debtAmount, 0);
});

test('fluxo Pagamento na Barbearia: cancelamento com menos de 2h registra divida de 100% da taxa', () => {
  const now = 1000000000;
  const startLessThan2h = now + (1 * 3600000);
  const barbConfig = { habilitado: true, tipo: 'fixo' as const, valor: 20 };

  const res = resolveCancellationFinancials({
    config: barbConfig,
    basePrice: 30,
    paidAmount: 0,
    isPrepaid: false,
    appointmentStartMs: startLessThan2h,
    nowMs: now,
    isNoShow: false,
  });

  strictEqual(res.freeCancellation, false);
  strictEqual(res.feeAmount, 20);
  strictEqual(res.refundAmount, 0);
  strictEqual(res.debtAmount, 20); // Dívida registrada de R$ 20
});

test('acumulo de dividas: soma de multiplas taxas e historico de itens', () => {
  const multiDebt = {
    row_id: 201,
    tenant_id: 'tenant-1',
    debito: {
      id: 'master-debt-1',
      cliente_id: 'client-1',
      cliente_nome: 'João Silva',
      total_pendente: 35,
      valor_taxa: 35,
      status: 'pendente',
      itens: [
        {
          id: 'item-1',
          agendamento_id: 'apt-1',
          barbeiro_id: 'barber-1',
          barbeiro_nome: 'Carlos',
          motivo: 'cancelamento_tardio',
          valor_taxa: 15,
          tipo_taxa: 'fixo',
          status: 'pendente',
          created_at: '2026-10-18T10:00:00Z',
        },
        {
          id: 'item-2',
          agendamento_id: 'apt-2',
          barbeiro_id: 'barber-1',
          barbeiro_nome: 'Carlos',
          motivo: 'falta',
          valor_taxa: 20,
          tipo_taxa: 'fixo',
          status: 'pendente',
          created_at: '2026-10-19T14:00:00Z',
        },
      ],
    },
  };

  const total = getPendingDebtTotal([multiDebt]);
  strictEqual(total, 35);

  const items = getPendingDebtItems([multiDebt]);
  strictEqual(items.length, 2);
  strictEqual(items[0].valor_taxa, 15);
  strictEqual(items[1].valor_taxa, 20);

  // Exemplo do documento: serviço de R$ 30,00 com dívida de R$ 20,00 resulta em R$ 50,00
  const servicePrice = 30;
  const debtToApply = 20;
  const checkoutTotal = servicePrice + debtToApply;
  strictEqual(checkoutTotal, 50);
});