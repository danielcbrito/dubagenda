export interface CancellationFeeConfig {
  habilitado: boolean;
  tipo: 'porcentagem' | 'fixo';
  valor: number;
  horas_antecedencia: number;
}

export function calculateCancellationFee(config: CancellationFeeConfig, price: number, start: number, now: number): number {
  if (!config.habilitado) return 0;
  if (!Number.isFinite(config.valor) || config.valor < 0 || !Number.isFinite(config.horas_antecedencia) || config.horas_antecedencia < 0 || (config.tipo === 'porcentagem' && config.valor > 100)) throw new Error('INVALID_CANCELLATION_CONFIG');
  if (config.horas_antecedencia > 0 && start - now > config.horas_antecedencia * 3600000) return 0;
  return Math.round((config.tipo === 'fixo' ? config.valor : Math.max(0, price) * config.valor / 100) * 100) / 100;
}

export function verifiedDebtPayment(charge: { correlationID?: string; status?: string; value?: number }, correlation: string, cents: number): boolean {
  return charge.correlationID === correlation && ['COMPLETED', 'ACTIVE_PAID'].includes(charge.status ?? '') && charge.value === cents && cents > 0;
}