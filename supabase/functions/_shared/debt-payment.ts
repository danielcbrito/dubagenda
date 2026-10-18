import { verifiedDebtPayment } from './cancellation-fee.ts';

export async function confirmDebtPayment(admin: any, local: any, appId: string) {
  const response = await fetch(`https://api.woovi.com/api/v1/charge/${encodeURIComponent(local.correlation_id)}`, { headers: { Authorization: appId } });
  if (!response.ok) throw new Error('Não foi possível verificar o pagamento PIX.');
  const result = await response.json();
  const charge = result.charge ?? result;
  if (!verifiedDebtPayment(charge, local.correlation_id, local.value_centavos)) return false;
  const { error } = await admin.rpc('settle_cancellation_debt', { p_correlation: local.correlation_id, p_cents: charge.value });
  if (error) throw error;
  return true;
}