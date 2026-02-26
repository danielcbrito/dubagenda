import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PendingReview {
  appointmentId: string;
  barberId: string;
  barberName: string;
  barberPhoto: string | null;
  serviceName: string;
  data: string;
}

/**
 * Hook para buscar agendamentos concluídos com barbeiros que ainda não foram avaliados.
 * Cada barbeiro só pode ter 1 avaliação por usuário — se já avaliou, não aparece como pendente.
 */
export function usePendingReviews(userId: string | null) {
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
  const [loading, setLoading] = useState(false);

  const loadPendingReviews = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      // Buscar agendamentos completed do usuário
      const { data: completed, error: aptError } = await supabase
        .from("agendamentos")
        .select("id, barbeiro_id, data, servico:servicos(nome)")
        .eq("user_id", userId)
        .eq("status", "completed")
        .not("barbeiro_id", "is", null)
        .order("data", { ascending: false })
        .limit(10);

      if (aptError) throw aptError;
      if (!completed || completed.length === 0) {
        setPendingReviews([]);
        return;
      }

      // Buscar barbeiros já avaliados pelo usuário (1 review por barbeiro)
      const barberIds = [...new Set(completed.map((a) => a.barbeiro_id).filter(Boolean))] as string[];
      
      const { data: existingReviews } = await supabase
        .from("barbeiro_avaliacoes")
        .select("barber_id")
        .eq("user_id", userId)
        .in("barber_id", barberIds);

      const reviewedBarberIds = new Set((existingReviews || []).map((r) => r.barber_id));

      // Filtrar: mostrar apenas o agendamento mais recente de cada barbeiro NÃO avaliado
      const seenBarbers = new Set<string>();
      const unreviewed = completed.filter((a) => {
        if (!a.barbeiro_id || reviewedBarberIds.has(a.barbeiro_id) || seenBarbers.has(a.barbeiro_id)) return false;
        seenBarbers.add(a.barbeiro_id);
        return true;
      });

      if (unreviewed.length === 0) {
        setPendingReviews([]);
        return;
      }

      // Buscar dados dos barbeiros
      const { data: barbers } = await supabase
        .from("barbeiros")
        .select("id, apelido, foto_url")
        .in("id", [...seenBarbers]);

      const barberMap = new Map((barbers || []).map((b) => [b.id, b]));

      const result: PendingReview[] = unreviewed
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

      setPendingReviews(result);
    } catch (err) {
      console.error("Erro ao carregar avaliações pendentes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingReviews();
  }, [userId]);

  return { pendingReviews, loading, refresh: loadPendingReviews };
}
