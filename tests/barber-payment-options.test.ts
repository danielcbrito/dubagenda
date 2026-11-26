import { describe, test } from 'node:test';
import { deepStrictEqual as equal } from 'node:assert';
import { CLIENT_PIX_ENABLED, canBarberReceiveBookingPix, isClientPixAllowed, parseBarberPaymentOptions, resolveBookingPaymentMethod } from '../src/lib/barber-payment-options';

describe('liberação global de PIX', () => {
  test('PIX está ativo para todos os clientes identificados', () => {
    equal(CLIENT_PIX_ENABLED, true);
    equal(isClientPixAllowed('danielcbrito74@gmail.com', null), true);
    equal(isClientPixAllowed('outro-cliente@example.com', null), true);
  });
  test('identifica a mesma conta pelo ID confirmado quando não há e-mail', () => {
    equal(isClientPixAllowed(null, '5d574ff2-4b2f-49d4-b260-1516a389cd80'), true);
    equal(isClientPixAllowed(null, 'aacff4be-266f-4a02-b1ce-b8d1ba642afc'), true);
  });
  test('não libera PIX antes de identificar o cliente', () => {
    equal(isClientPixAllowed(null, null), false);
  });
});

describe('elegibilidade PIX do profissional', () => {
  test('Mercado Pago aprovado sem chave Woovi pode receber PIX', () => {
    equal(canBarberReceiveBookingPix(null, [{ status: 'approved', provider: 'mercadopago' }]), true);
  });
  test('Woovi aprovado sem chave legada pode receber PIX', () => {
    equal(canBarberReceiveBookingPix(null, [{ status: 'approved', provider: 'woovi' }]), true);
  });
  test('chave Woovi preenchida permite PIX sem conta aprovada', () => {
    equal(canBarberReceiveBookingPix('barber@example.com', []), true);
  });
  test('contas pendentes, rejeitadas ou provedores desconhecidos não permitem PIX', () => {
    equal(canBarberReceiveBookingPix(null, [{ status: 'pending', provider: 'mercadopago' }, { status: 'rejected', provider: 'woovi' }, { status: 'approved', provider: 'other' }]), false);
    equal(canBarberReceiveBookingPix('   ', []), false);
  });
});

describe('configuração de pagamento do barbeiro', () => {
  test('ausência de configuração habilita PIX e pagamento presencial', () => {
    equal(parseBarberPaymentOptions(null), { pix: true, barbearia: true });
  });
  test('JSON inválido mantém os dois padrões habilitados', () => {
    equal(parseBarberPaymentOptions('{'), { pix: true, barbearia: true });
  });
  test('somente booleanos alteram os padrões', () => {
    equal(parseBarberPaymentOptions('{"pix":"false","barbearia":0}'), { pix: true, barbearia: true });
  });
  test('PIX desativado permanece falso', () => {
    equal(parseBarberPaymentOptions('{"pix":false}').pix, false);
  });
  test('pagamento presencial desativado permanece falso', () => {
    equal(parseBarberPaymentOptions('{"barbearia":false}').barbearia, false);
  });
  test('PIX desativado troca para pagamento presencial', () => {
    equal(resolveBookingPaymentMethod('pix', { pix: false, cash: true, wallet: false, card: false }), 'cash');
  });
  test('presencial desativado troca para PIX', () => {
    equal(resolveBookingPaymentMethod('cash', { pix: true, cash: false, wallet: false, card: false }), 'pix');
  });
  test('não seleciona métodos quando todos estão indisponíveis', () => {
    equal(resolveBookingPaymentMethod('cash', { pix: false, cash: false, wallet: false, card: false }), null);
  });
  test('mantém a escolha se ainda estiver habilitada', () => {
    equal(resolveBookingPaymentMethod('cash', { pix: true, cash: true, wallet: false, card: false }), 'cash');
  });
});