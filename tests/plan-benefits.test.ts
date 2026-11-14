import { describe, test } from 'node:test';
import { deepStrictEqual as equal } from 'node:assert';
import { parsePlanBenefits } from '../src/lib/plan-benefits';

describe('parsePlanBenefits', () => {
  test('returns empty array for null/undefined/non-array', () => {
    equal(parsePlanBenefits(null), []);
    equal(parsePlanBenefits(undefined), []);
    equal(parsePlanBenefits(42), []);
    equal(parsePlanBenefits({}), []);
  });

  test('returns empty array for empty array', () => {
    equal(parsePlanBenefits([]), []);
  });

  test('filters out empty and blank strings', () => {
    equal(
      parsePlanBenefits(['Corte grátis', '', '  ', 'Prioridade', '\t', '\n']),
      ['Corte grátis', 'Prioridade']
    );
  });

  test('keeps all non-blank strings', () => {
    equal(
      parsePlanBenefits(['Corte grátis', 'Horário prioritário', 'Desconto']),
      ['Corte grátis', 'Horário prioritário', 'Desconto']
    );
  });

  test('parses JSON string and filters blanks', () => {
    equal(
      parsePlanBenefits('["Corte grátis", "", "  ", "Prioridade"]'),
      ['Corte grátis', 'Prioridade']
    );
  });

  test('returns empty array for invalid JSON string', () => {
    equal(parsePlanBenefits('not json'), []);
    equal(parsePlanBenefits('{'), []);
  });

  test('handles null elements inside array', () => {
    equal(parsePlanBenefits(['Corte grátis', null, 'Prioridade', undefined]), [
      'Corte grátis',
      'Prioridade',
    ]);
  });
});
