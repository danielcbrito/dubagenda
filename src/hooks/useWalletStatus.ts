import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCache, setCache } from "@/utils/cache";

/**
 * useWalletStatus
 * Verifica se um barbeiro pode receber pagamentos PIX no app do cliente.
 * Critério: o barbeiro precisa ter uma carteira com chave PIX validada
 * (Efí Bank). Usa RPC `validate_barber_can_receive_pix` como fonte de
 * verdade (mesma checagem usada pelo backend antes de gerar cobrança).
 *
 * Cache: sessionStorage por 5 minutos para evitar flicker no Step 5 do
 * fluxo de agendamento. Se o status mudar enquanto o cliente está no
 * checkout, o backend recusa a cobrança com erro amigável (Fase 2).
 */
export function useWalletStatus(barbeiroId: string | null | undefined) {
  const [canReceivePix, setCanReceivePix] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!barbeiroId) {
      setCanReceivePix(false);
      setLoading(false);
      return;
    }

    const cacheKey = `wallet_pix_status:${barbeiroId}`;
    const cached = getCache<boolean>(cacheKey);
    if (cached !== null) {
      setCanReceivePix(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const { data, error } = await supabase.rpc(
          "validate_barber_can_receive_pix",
          { p_barbeiro_id: barbeiroId }
        );
        if (cancelled) return;
        const value = !error && data === true;
        setCanReceivePix(value);
        setCache(cacheKey, value, 5);
      } catch {
        if (!cancelled) setCanReceivePix(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [barbeiroId]);

  return { canReceivePix, loading };
}
