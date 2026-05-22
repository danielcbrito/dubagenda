import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook para verificar se o cliente possui uma assinatura pendente (suspended ou pending_cash).
 * Utilizado para mostrar badges de notificação e gatilhos de UI.
 */
export function usePendingSubscription(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['cliente', 'pending-subscription', userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data, error } = await supabase
        .from("assinaturas")
        .select(`
          id,
          status,
          plano_id,
          payment_method,
          pix_qr_code,
          pix_payload,
          asaas_payment_id,
          pix_expires_at,
          plano:planos(nome, preco_mensal)
        `)
        .eq("user_id", userId)
        .in("status", ["suspended", "pending_cash", "pending_renewal"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error("Erro ao buscar assinatura pendente:", error);
        return null;
      }
      
      return data;
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 segundos
  });
}
