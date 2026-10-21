import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DividaItem {
  id: string;
  cliente_id: string;
  barbeiro_id: string;
  barbeiro_nome?: string;
  agendamento_id: string;
  agendamento_data?: string;
  agendamento_hora?: string;
  servico_nome?: string;
  valor_total: number;
  valor_barbeiro: number;
  valor_plataforma: number;
  status: 'pendente' | 'pago' | 'cancelado' | string;
  pix_qr_code?: string | null;
  pix_id?: string | null;
  criado_em: string;
  pago_em?: string | null;
}

export function useDividas(userId: string | undefined) {
  const [pendingDebt, setPendingDebt] = useState<DividaItem | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDebt = useCallback(async () => {
    if (!userId) {
      setPendingDebt(null);
      setLoading(false);
      return;
    }

    try {
      // 1. Tentar RPC otimizada primeiro
      const { data: rpcData, error: rpcError } = await supabase.rpc('consultar_minhas_dividas');

      if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
        setPendingDebt(rpcData[0] as DividaItem);
        setLoading(false);
        return;
      }

      // 2. Fallback direto via consulta na tabela dividas
      const { data, error } = await supabase
        .from('dividas')
        .select(`
          id,
          cliente_id,
          barbeiro_id,
          agendamento_id,
          valor_total,
          valor_barbeiro,
          valor_plataforma,
          status,
          pix_qr_code,
          pix_id,
          criado_em,
          pago_em,
          barbeiro:barbeiros(apelido),
          agendamento:agendamentos(data, hora, servico:servicos(nome))
        `)
        .eq('cliente_id', userId)
        .eq('status', 'pendente')
        .order('criado_em', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        const row = data[0] as any;
        setPendingDebt({
          id: row.id,
          cliente_id: row.cliente_id,
          barbeiro_id: row.barbeiro_id,
          barbeiro_nome: row.barbeiro?.apelido || 'Barbeiro',
          agendamento_id: row.agendamento_id,
          agendamento_data: row.agendamento?.data,
          agendamento_hora: row.agendamento?.hora,
          servico_nome: row.agendamento?.servico?.nome || 'Serviço',
          valor_total: Number(row.valor_total) || 0,
          valor_barbeiro: Number(row.valor_barbeiro) || 0,
          valor_plataforma: Number(row.valor_plataforma) || 0,
          status: row.status,
          pix_qr_code: row.pix_qr_code,
          pix_id: row.pix_id,
          criado_em: row.criado_em,
          pago_em: row.pago_em,
        });
      } else {
        setPendingDebt(null);
      }
    } catch (err) {
      console.warn('[useDividas] Erro ao carregar dívidas:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const refresh = useCallback(() => {
    window.dispatchEvent(new Event('cancellation-debt-changed'));
    void loadDebt();
  }, [loadDebt]);

  useEffect(() => {
    if (!userId) return;

    void loadDebt();

    // Escuta em tempo real na tabela dividas
    const channel = supabase
      .channel(`realtime-dividas-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dividas',
          filter: `cliente_id=eq.${userId}`,
        },
        (payload) => {
          const newRow = payload.new as any;
          if (payload.eventType === 'DELETE' || (newRow && newRow.status === 'pago')) {
            setPendingDebt(null);
          } else {
            void loadDebt();
          }
        }
      )
      .subscribe();

    const onChange = () => {
      void loadDebt();
    };

    window.addEventListener('cancellation-debt-changed', onChange);
    window.addEventListener('focus', onChange);

    const interval = window.setInterval(onChange, 20000);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('cancellation-debt-changed', onChange);
      window.removeEventListener('focus', onChange);
      void supabase.removeChannel(channel);
    };
  }, [userId, loadDebt]);

  return {
    pendingDebt,
    hasDebt: Boolean(pendingDebt && pendingDebt.status === 'pendente' && pendingDebt.valor_total > 0),
    loading,
    refresh,
  };
}
