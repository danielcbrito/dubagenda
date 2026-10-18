import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { parseBarberPaymentOptions, type BarberPaymentOptions } from '@/lib/barber-payment-options';

/** Configuração isolada por barbearia/profissional, sem cache persistente. */
export function useBarberPaymentOptions(barberId: string | null, tenantId: string | null) {
  const key = barberId && tenantId ? `${tenantId}:${barberId}` : null;
  const [state, setState] = useState<{
    key: string | null;
    options: BarberPaymentOptions;
    ready: boolean;
    error: boolean;
  }>({ key: null, options: { pix: true, barbearia: true }, ready: false, error: false });

  useEffect(() => {
    if (!barberId || !tenantId || !key) return;
    let disposed = false;
    let revision = 0;
    const configKey = `formas_pagamento_${barberId}`;
    setState({ key, options: parseBarberPaymentOptions(), ready: false, error: false });

    const load = async () => {
      const requestRevision = ++revision;
      const { data, error } = await supabase
        .from('informacoes_empresa')
        .select('valor')
        .eq('tenant_id', tenantId)
        .eq('chave', configKey)
        .maybeSingle();
      if (disposed || revision !== requestRevision) return;
      setState({ key, options: parseBarberPaymentOptions(data?.valor), ready: !error, error: !!error });
    };

    const channel = supabase.channel(`booking-payment-options:${key}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'informacoes_empresa',
        filter: `chave=eq.${configKey}`,
      }, ({ new: row }) => {
        if (disposed || row.tenant_id !== tenantId) return;
        ++revision;
        setState({ key, options: parseBarberPaymentOptions(row.valor), ready: true, error: false });
      })
      .subscribe(status => {
        // Fecha a janela entre a consulta inicial e a assinatura; também atualiza após reconexão.
        if (status === 'SUBSCRIBED') void load();
      });
    void load();
    return () => {
      disposed = true;
      void supabase.removeChannel(channel);
    };
  }, [barberId, tenantId, key]);

  const current = key !== null && state.key === key;
  return {
    pixHabilitado: current && state.ready && state.options.pix,
    barbeariaHabilitado: current && state.ready && state.options.barbearia,
    loading: !current || (!state.ready && !state.error),
    error: current && state.error,
  };
}