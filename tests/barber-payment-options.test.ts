import { describe, test } from 'node:test';
import { deepStrictEqual as equal } from 'node:assert';
import { parseBarberPaymentOptions, resolveBookingPaymentMethod } from '../src/lib/barber-payment-options';

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