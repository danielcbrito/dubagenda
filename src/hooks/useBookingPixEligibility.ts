import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { canBarberReceiveBookingPix } from '@/lib/barber-payment-options';

/** Tenant-scoped eligibility; never exposes the private financial account row. */
export function useBookingPixEligibility(barberId: string | null, tenantId: string | null) {
  const key = barberId && tenantId ? `${tenantId}:${barberId}` : null;
  const [state, setState] = useState({ key: null as string | null, wooviKey: null as string | null, eligible: false });

  useEffect(() => {
    if (!barberId || !tenantId || !key) return;
    let disposed = false;
    const load = async () => {
      try {
        const [barber, accounts] = await Promise.all([
          supabase.from('barbeiros').select('woovi_pix_key')
            .eq('id', barberId).eq('tenant_id', tenantId).maybeSingle(),
          supabase.rpc('get_barber_booking_payment_accounts', {
            p_barbeiro_id: barberId, p_tenant_id: tenantId,
          }),
        ]);
        if (disposed) return;
        const wooviKey = barber.error ? null : barber.data?.woovi_pix_key ?? null;
        setState({ key, wooviKey, eligible: canBarberReceiveBookingPix(wooviKey, accounts.error ? [] : accounts.data ?? []) });
      } catch {
        if (!disposed) setState({ key, wooviKey: null, eligible: false });
      }
    };
    void load();
    return () => { disposed = true; };
  }, [barberId, tenantId, key]);

  const current = key !== null && state.key === key;
  return { canReceivePix: current && state.eligible, wooviKey: current ? state.wooviKey : null };
}