import { describe, test } from 'node:test';
import { deepStrictEqual as equal } from 'node:assert';
import { isClientPixAllowed, parseBarberPaymentOptions, resolveBookingPaymentMethod } from '../src/lib/barber-payment-options';

describe('liberação individual de PIX', () => {
  test('libera somente o e-mail solicitado', () => {
    equal(isClientPixAllowed('danielcbrito74@gmail.com', null), true);
    equal(isClientPixAllowed('outro-cliente@example.com', null), false);
  });
  test('identifica a mesma conta pelo ID confirmado quando não há e-mail', () => {
    equal(isClientPixAllowed(null, '5d574ff2-4b2f-49d4-b260-1516a389cd80'), true);
    equal(isClientPixAllowed(null, 'aacff4be-266f-4a02-b1ce-b8d1ba642afc'), false);
  });
  test('não libera PIX antes de identificar o cliente', () => {
    equal(isClientPixAllowed(null, null), false);
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