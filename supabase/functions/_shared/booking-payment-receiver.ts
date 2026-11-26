import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { selectBookingPixProvider, BookingPixAccountError } from './booking-payment-route.ts';
import { sellerToken } from './mercadopago-seller.ts';

export async function resolveBookingPixReceiver(admin: SupabaseClient<any>, barberId: string, tenantId: string) {
  const { data: barber, error: barberError } = await admin.from('barbeiros').select('id')
    .eq('id', barberId).eq('tenant_id', tenantId).eq('ativo', true).is('deleted_at', null).maybeSingle();
  if (barberError || !barber) throw new BookingPixAccountError('Profissional indisponível nesta barbearia.');
  const { data: account, error: accountError } = await admin.from('barber_payment_accounts')
    .select('status,provider').eq('barbeiro_id', barberId).eq('tenant_id', tenantId).maybeSingle();
  if (accountError) throw new Error('Não foi possível consultar a conta de recebimento.');
  if (account?.status !== 'approved') throw new BookingPixAccountError('O profissional ainda não tem uma conta de recebimento aprovada. Escolha outra forma de pagamento.');
  let credential: string | null = null;
  if (account.provider === 'mercadopago') credential = await sellerToken(admin, barberId);
  if (account.provider === 'woovi') {
    const { data, error } = await admin.from('barber_payment_credentials').select('app_id')
      .eq('barbeiro_id', barberId).maybeSingle();
    if (error) throw new Error('Não foi possível consultar a conexão Woovi.');
    credential = data?.app_id?.trim() || null;
  }
  const provider = selectBookingPixProvider(account, account.provider === 'mercadopago' && !!credential,
    account.provider === 'woovi' && !!credential);
  if (!provider || !credential) throw new BookingPixAccountError('A conta do profissional precisa ser reconectada no aplicativo do barbeiro.');
  return { provider, credential };
}