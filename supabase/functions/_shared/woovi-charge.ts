import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { wooviFetch, WooviError } from './woovi-client.ts';
import { resolveBookingPixReceiver } from './booking-payment-receiver.ts';
import { mpFetch } from './mercadopago-seller.ts';

interface ChargeInput {
  correlationID: string;
  userId: string;
  barberId: string;
  tenantId: string;
  receiver?: Awaited<ReturnType<typeof resolveBookingPixReceiver>>;
  amount: number;
  comment: string;
  target?: Record<string, unknown>;
}
interface ChargeResponse { charge?: { identifier?: string; brCode?: string; qrCodeImage?: string; status?: string; value?: number } }

export async function createWooviCharge(admin: SupabaseClient<any>, input: ChargeInput) {
  const cents = Math.round(input.amount * 100);
  if (!Number.isSafeInteger(cents) || cents < 100) throw new Error('Valor mínimo para Pix: R$ 1,00');
  const receiver = input.receiver ?? await resolveBookingPixReceiver(admin, input.barberId, input.tenantId);
  if (receiver.provider === 'mercadopago') return createMercadoPagoCharge(admin, input, cents, receiver.credential);
  const ownAppId = receiver.credential;
  // Persist intent before asking the bank, so an early callback can be reconciled.
  const { error: intentError } = await admin.from('woovi_charges').upsert({
    correlation_id: input.correlationID, user_id: input.userId, barbeiro_id: input.barberId,
    value_centavos: cents, ...input.target,
  }, { onConflict: 'correlation_id', ignoreDuplicates: true });
  if (intentError) throw intentError;
  const { data: existing, error: existingError } = await admin.from('woovi_charges').select('value_centavos, user_id, barbeiro_id').eq('correlation_id', input.correlationID).single();
  if (existingError) throw existingError;
  if (existing.user_id !== input.userId || existing.barbeiro_id !== input.barberId || existing.value_centavos !== cents) throw new Error('CHARGE_INTENT_MISMATCH');
  let response: ChargeResponse;
  try {
    response = await wooviFetch<ChargeResponse>(`/api/v1/charge/${encodeURIComponent(input.correlationID)}`, { appId: ownAppId });
  } catch (error) {
    if (!(error instanceof WooviError) || error.status !== 404) throw error;
    // Taxa bancária fixa cobrada pela Woovi em cada Pix (R$ 0,50).
    // Descontada do split da subconta do barbeiro para que cada profissional
    // pague a taxa do seu próprio Pix recebido e mantenha o caixa equilibrado.
    response = await wooviFetch<ChargeResponse>('/api/v1/charge', { method: 'POST', appId: ownAppId, body: { correlationID: input.correlationID, value: cents, comment: input.comment } });
  }
  const charge = response.charge;
  if (charge?.value !== cents) throw new Error('BANK_CHARGE_VALUE_MISMATCH');
  if (!charge?.brCode) throw new Error('Woovi não retornou código Pix; cobrança precisa ser conferida antes de tentar novamente');
  const { error: saveError } = await admin.from('woovi_charges').update({
    charge_id: charge.identifier ?? null, br_code: charge.brCode, qr_code_image: charge.qrCodeImage ?? null,
    raw_response: response,
  }).eq('correlation_id', input.correlationID);
  if (saveError) throw new Error('Cobrança criada na Woovi, mas registro local falhou; solicite reconciliação');
  return { id: input.correlationID, status: 'ACTIVE', value: input.amount,
    pixQrCode: { encodedImage: charge.qrCodeImage ?? '', payload: charge.brCode } };
}

/** Pix na conta Mercado Pago do próprio barbeiro; confirmado pelo aviso na mercadopago-oauth. */
async function createMercadoPagoCharge(admin: SupabaseClient<any>, input: ChargeInput, cents: number, token: string) {
  const { error: intentError } = await admin.from('woovi_charges').upsert({
    correlation_id: input.correlationID, user_id: input.userId, barbeiro_id: input.barberId, value_centavos: cents, ...input.target,
  }, { onConflict: 'correlation_id', ignoreDuplicates: true });
  if (intentError) throw intentError;
  const { data: existing } = await admin.from('woovi_charges').select('value_centavos, user_id, barbeiro_id, br_code, qr_code_image').eq('correlation_id', input.correlationID).single();
  if (!existing || existing.user_id !== input.userId || existing.barbeiro_id !== input.barberId || existing.value_centavos !== cents) throw new Error('CHARGE_INTENT_MISMATCH');
  if (existing.br_code) return { id: input.correlationID, status: 'ACTIVE', value: input.amount, pixQrCode: { encodedImage: existing.qr_code_image ?? '', payload: existing.br_code } };
  const { data: u } = await admin.auth.admin.getUserById(input.userId);
  const email = u?.user?.email;
  if (!email) throw new Error('Cliente sem e-mail cadastrado; Pix indisponível');
  const p = await mpFetch(token, 'v1/payments', { method: 'POST', idempotencyKey: `pix-${input.correlationID}`, body: {
    transaction_amount: cents / 100, payment_method_id: 'pix', description: input.comment.slice(0, 200),
    external_reference: input.correlationID, payer: { email },
    notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mercadopago-oauth?b=${input.barberId}`,
  } });
  const td = p?.point_of_interaction?.transaction_data;
  if (!td?.qr_code) throw new Error('Mercado Pago não retornou código Pix');
  const img = td.qr_code_base64 ? `data:image/png;base64,${td.qr_code_base64}` : '';
  const { error: saveError } = await admin.from('woovi_charges').update({ charge_id: String(p.id), br_code: td.qr_code, qr_code_image: img, raw_response: { provider: 'mercadopago', id: p.id, status: p.status } }).eq('correlation_id', input.correlationID);
  if (saveError) throw new Error('Cobrança criada no Mercado Pago, mas registro local falhou; solicite reconciliação.');
  return { id: input.correlationID, status: 'ACTIVE', value: input.amount, pixQrCode: { encodedImage: img, payload: td.qr_code } };
}
