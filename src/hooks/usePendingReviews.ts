import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PendingReview {
  appointmentId: string;
  barberId: string;
  barberName: string;
  barberPhoto: string | null;
  serviceName: string;
  data: string;
}

const fetchPendingReviews = async (userId: string): Promise<PendingReview[]> => {
  const { data: completed, error: aptError } = await supabase
    .from("agendamentos")
    .select("id, barbeiro_id, data, servico:servicos(nome)")
    .eq("user_id", userId)
    .eq("status", "completed")
    .not("barbeiro_id", "is", null)
    .order("data", { ascending: false })
    .limit(10);

  if (aptError) throw aptError;
  if (!completed || completed.length === 0) return [];

  const barberIds = [...new Set(completed.map((a) => a.barbeiro_id).filter(Boolean))] as string[];

  const { data: existingReviews } = await supabase
    .from("barbeiro_avaliacoes")
    .select("barber_id")
    .eq("user_id", userId)
    .in("barber_id", barberIds);

  const reviewedBarberIds = new Set((existingReviews || []).map((r) => r.barber_id));

  const seenBarbers = new Set<string>();
  const unreviewed = completed.filter((a) => {
    if (!a.barbeiro_id || reviewedBarberIds.has(a.barbeiro_id) || seenBarbers.has(a.barbeiro_id)) return false;
    seenBarbers.add(a.barbeiro_id);
    return true;
  });

  if (unreviewed.length === 0) return [];

  const { data: barbers } = await supabase
    .from("barbeiros")
    .select("id, apelido, foto_url")
    .in("id", [...seenBarbers]);

  const barberMap = new Map((barbers || []).map((b) => [b.id, b]));

  return unreviewed
    .filter((a) => a.barbeiro_id && barberMap.has(a.barbeiro_id))
    .map((a) => {
      const barber = barberMap.get(a.barbeiro_id!)!;
      return {
        appointmentId: a.id,
        barberId: a.barbeiro_id!,
        barberName: barber.apelido,
        barberPhoto: barber.foto_url,
        serviceName: (a.servico as any)?.nome || "Serviço",
        data: a.data,
      };
    });
};

export function usePendingReviews(userId: string | null) {
  const queryClient = useQueryClient();

  const { data: pendingReviews = [], isLoading: loading } = useQuery({
    queryKey: ['cliente', 'pending-reviews', userId],
    queryFn: () => fetchPendingReviews(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const refresh = useCallback(() => {
    if (userId) {
      queryClient.invalidateQueries({ queryKey: ['cliente', 'pending-reviews', userId] });
    }
  }, [userId, queryClient]);

  return { pendingReviews, loading, refresh };
}
