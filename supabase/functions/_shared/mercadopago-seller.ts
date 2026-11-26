import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { BookingPixAccountError } from './booking-payment-route.ts';

/** Use the stored seller connection; OAuth setup remains owned by the barber app. */
export async function sellerToken(admin: SupabaseClient<any>, barberId: string): Promise<string | null> {
  const { data, error } = await admin.from('barber_mp_credentials')
    .select('access_token,refresh_token,expires_at').eq('barbeiro_id', barberId).maybeSingle();
  if (error) throw new Error('Não foi possível consultar a conexão Mercado Pago.');
  if (!data?.access_token) return null;
  const expires = Date.parse(data.expires_at);
  if (expires > Date.now() + 86400000) return data.access_token;
  const clientId = Deno.env.get('MP_CLIENT_ID');
  const clientSecret = Deno.env.get('MP_CLIENT_SECRET');
  // Existing valid connections do not require any new project secret.
  if (!clientId || !clientSecret || !data.refresh_token) {
    if (expires > Date.now()) return data.access_token;
    throw new BookingPixAccountError('O profissional precisa reconectar a conta Mercado Pago no aplicativo do barbeiro.');
  }
  const response = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token', refresh_token: data.refresh_token }),
  });
  const token = await response.json().catch(() => null);
  if (!response.ok || !token?.access_token || !token.refresh_token || !Number.isFinite(token.expires_in)) {
    throw new BookingPixAccountError('O profissional precisa reconectar a conta Mercado Pago no aplicativo do barbeiro.');
  }
  const { error: saveError } = await admin.from('barber_mp_credentials').update({
    access_token: token.access_token, refresh_token: token.refresh_token,
    expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
  }).eq('barbeiro_id', barberId);
  if (saveError) throw new Error('Não foi possível atualizar a conexão Mercado Pago.');
  return token.access_token;
}

export async function mpFetch<T = any>(token: string, path: string, init: { method?: string; body?: unknown; idempotencyKey?: string } = {}): Promise<T> {
  const response = await fetch(`https://api.mercadopago.com/${path}`, {
    method: init.method ?? 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
      ...(init.idempotencyKey ? { 'X-Idempotency-Key': init.idempotencyKey } : {}) },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });
  if (!response.ok) throw new Error(`Mercado Pago recusou a operação (${response.status}).`);
  return response.json();
}