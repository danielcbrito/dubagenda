import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook para verificar se o cliente possui uma assinatura expirada (cancelada
 * com a data de vencimento já passada). Utilizado para exibir a tela de renovação
 * do plano ("Seu plano chegou ao fim!") em lugares como a aba "Planos" da
 * navegação inferior.
 */
export function useExpiredSubscription(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['cliente', 'expired-subscription', userId],
    queryFn: async () => {
      if (!userId) return null;

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from("assinaturas")
        .select("id, status, plano_id, updated_at, next_billing_date, plano:planos(id, nome, descricao, limite_agendamentos_mes, preco_mensal, beneficios_json, servico:servicos(nome))")
        .eq("user_id", userId)
        .eq("status", "cancelled")
        .not("next_billing_date", "is", null)
        .gte("updated_at", thirtyDaysAgo.toISOString())
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Erro ao buscar assinatura expirada:", error);
        return null;
      }

      const isRealExpired =
        data?.next_billing_date &&
        new Date(data.next_billing_date + "T00:00:00") < new Date();

      return isRealExpired ? data : null;
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 segundos
  });
}
