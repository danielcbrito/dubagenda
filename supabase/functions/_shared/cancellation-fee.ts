export interface CancellationFeeConfig {
  habilitado: boolean;
  tipo: 'porcentagem' | 'fixo';
  valor: number;
  horas_antecedencia?: number;
}

export const CANCELLATION_FREE_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 horas (regra de sistema)

/**
 * Retorna se o agendamento pode ser cancelado gratuitamente (mais de 2 horas antes do horário).
 */
export function isFreeCancellation(appointmentStartMs: number, nowMs: number = Date.now()): boolean {
  return (appointmentStartMs - nowMs) > CANCELLATION_FREE_WINDOW_MS;
}

/**
 * Calcula a taxa de cancelamento baseada na configuração do barbeiro e nas regras do sistema.
 * Regra: Cancelamento com mais de 2 horas de antecedência é 100% gratuito.
 * Se faltar menos de 2 horas ou for falta (no-show), aplica a taxa configurada.
 */
export function calculateCancellationFee(
  config: CancellationFeeConfig | Partial<CancellationFeeConfig> | null | undefined,
  price: number,
  start: number,
  now: number,
  isNoShow = false
): number {
  if (!config || !config.habilitado) return 0;
  if (
    !Number.isFinite(config.valor) ||
    (config.valor ?? 0) < 0 ||
    (typeof config.horas_antecedencia === 'number' && (!Number.isFinite(config.horas_antecedencia) || config.horas_antecedencia < 0)) ||
    (config.tipo === 'porcentagem' && (config.valor ?? 0) > 100)
  ) {
    throw new Error('INVALID_CANCELLATION_CONFIG');
  }

  // Janela de cancelamento gratuito: 2 horas por padrão do sistema
  const windowMs = typeof config.horas_antecedencia === 'number'
    ? config.horas_antecedencia * 3600000
    : CANCELLATION_FREE_WINDOW_MS;

  if (!isNoShow && windowMs > 0 && (start - now) > windowMs) {
    return 0;
  }

  const val = Number(config.valor) || 0;
  return Math.round((config.tipo === 'fixo' ? val : Math.max(0, price) * val / 100) * 100) / 100;
}

export function resolveBaseCancellationPrice(
  appointmentPrice: number | null | undefined,
  catalogServicePrice: number | null | undefined
): number {
  if (typeof appointmentPrice === 'number' && Number.isFinite(appointmentPrice) && appointmentPrice > 0) {
    return appointmentPrice;
  }
  if (typeof catalogServicePrice === 'number' && Number.isFinite(catalogServicePrice) && catalogServicePrice > 0) {
    return catalogServicePrice;
  }
  return 0;
}

export interface CancellationResolution {
  freeCancellation: boolean;
  feeAmount: number;
  refundAmount: number;
  debtAmount: number;
  isPrepaid: boolean;
  hoursRemaining: number;
  message: string;
}

/**
 * Resolve o desfecho financeiro completo de um cancelamento:
 * - Pagamento Pix / Antecipado: desconta a taxa do reembolso (reembolso líquido = valor_pago - taxa)
 * - Pagamento na barbearia / Presencial: registra a taxa como dívida
 */
export function resolveCancellationFinancials(params: {
  config: CancellationFeeConfig | Partial<CancellationFeeConfig> | null | undefined;
  basePrice: number;
  paidAmount: number;
  isPrepaid: boolean;
  appointmentStartMs: number;
  nowMs?: number;
  isNoShow?: boolean;
}): CancellationResolution {
  const { config, basePath = 0, paidAmount, isPrepaid, appointmentStartMs, nowMs = Date.now(), isNoShow = false } = params as any;
  const hoursRemaining = Math.max(0, (appointmentStartMs - nowMs) / 3600000);
  const isFree = !isNoShow && isFreeCancellation(appointmentStartMs, nowMs);

  if (isFree || !config?.habilitado) {
    return {
      freeCancellation: true,
      feeAmount: 0,
      refundAmount: isPrepaid ? paidAmount : 0,
      debtAmount: 0,
      isPrepaid,
      hoursRemaining,
      message: isPrepaid
        ? `Cancelamento gratuito. Reembolso integral de R$ ${paidAmount.toFixed(2).replace('.', ',')} creditado na sua carteira.`
        : 'Cancelamento gratuito confirmado sem cobrança de taxa.',
    };
  }

  const fee = calculateCancellationFee(config, params.basePrice, appointmentStartMs, nowMs, isNoShow);

  if (isPrepaid) {
    const netRefund = Math.max(0, paidAmount - fee);
    const remainingDebt = Math.max(0, fee - paidAmount);
    return {
      freeCancellation: false,
      feeAmount: fee,
      refundAmount: Math.round(netRefund * 100) / 100,
      debtAmount: Math.round(remainingDebt * 100) / 100,
      isPrepaid: true,
      hoursRemaining,
      message: netRefund > 0
        ? `Cancelamento com menos de 2h. Taxa de R$ ${fee.toFixed(2).replace('.', ',')} descontada. Reembolso de R$ ${netRefund.toFixed(2).replace('.', ',')} creditado na carteira.`
        : `Cancelamento com menos de 2h. Taxa de R$ ${fee.toFixed(2).replace('.', ',')} aplicada.`,
    };
  } else {
    return {
      freeCancellation: false,
      feeAmount: fee,
      refundAmount: 0,
      debtAmount: fee,
      isPrepaid: false,
      hoursRemaining,
      message: `Cancelamento com menos de 2h. Taxa de R$ ${fee.toFixed(2).replace('.', ',')} registrada e somada ao seu próximo agendamento.`,
    };
  }
}

export function verifiedDebtPayment(
  charge: { correlationID?: string; status?: string; value?: number },
  correlation: string,
  cents: number
): boolean {
  return (
    charge.correlationID === correlation &&
    ['COMPLETED', 'ACTIVE_PAID'].includes(charge.status ?? '') &&
    charge.value === cents &&
    cents > 0
  );
}