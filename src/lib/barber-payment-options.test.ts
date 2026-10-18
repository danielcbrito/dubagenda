import { describe, expect, test } from 'bun:test';
import { parseBarberPaymentOptions, resolveBookingPaymentMethod } from './barber-payment-options';

describe('configuração de pagamento do barbeiro', () => {
  test('ausência de configuração habilita PIX e pagamento presencial', () => {
    expect(parseBarberPaymentOptions(null)).toEqual({ pix: true, barbearia: true });
  });
  test('JSON inválido mantém os dois padrões habilitados', () => {
    expect(parseBarberPaymentOptions('{')).toEqual({ pix: true, barbearia: true });
  });
  test('somente booleanos alteram os padrões', () => {
    expect(parseBarberPaymentOptions('{"pix":"false","barbearia":0}')).toEqual({ pix: true, barbearia: true });
  });
  test('PIX desativado permanece falso', () => {
    expect(parseBarberPaymentOptions('{"pix":false}').pix).toBe(false);
  });
  test('pagamento presencial desativado permanece falso', () => {
    expect(parseBarberPaymentOptions('{"barbearia":false}').barbearia).toBe(false);
  });
  test('PIX desativado troca para pagamento presencial', () => {
    expect(resolveBookingPaymentMethod('pix', { pix: false, cash: true, wallet: false, card: false })).toBe('cash');
  });
  test('presencial desativado troca para PIX', () => {
    expect(resolveBookingPaymentMethod('cash', { pix: true, cash: false, wallet: false, card: false })).toBe('pix');
  });
  test('não seleciona métodos quando todos estão indisponíveis', () => {
    expect(resolveBookingPaymentMethod('cash', { pix: false, cash: false, wallet: false, card: false })).toBeNull();
  });
  test('mantém a escolha se ainda estiver habilitada', () => {
    expect(resolveBookingPaymentMethod('cash', { pix: true, cash: true, wallet: false, card: false })).toBe('cash');
  });
});