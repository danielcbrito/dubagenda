import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { readPendingDebts, type CancellationDebt } from '@/lib/cancellation-debt';

export function useCancellationDebt(userId: string | undefined) {
  const [state, setState] = useState<{ userId?: string; debts: CancellationDebt[] }>({ debts: [] });
  const refresh = useCallback(() => window.dispatchEvent(new Event('cancellation-debt-changed')), []);
  useEffect(() => {
    if (!userId) return;
    let disposed = false;
    let revision = 0;
    const load = async () => {
      const request = ++revision;
      const { data, error } = await supabase.rpc('get_my_cancellation_debts');
      if (disposed || revision !== request || error) return;
      setState({ userId, debts: readPendingDebts(data, userId) });
    };
    const onChange = () => { void load(); };
    const channel = supabase.channel(`client-cancellation-debt:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'informacoes_empresa', filter: `chave=eq.debito_cancelamento_${userId}` }, onChange)
      .subscribe(status => { if (status === 'SUBSCRIBED') void load(); });
    void load();
    window.addEventListener('cancellation-debt-changed', onChange);
    window.addEventListener('focus', onChange);
    const interval = window.setInterval(onChange, 30000);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.removeEventListener('cancellation-debt-changed', onChange);
      window.removeEventListener('focus', onChange);
      void supabase.removeChannel(channel);
    };
  }, [userId]);
  return { debts: state.userId === userId ? state.debts : [], refresh };
}