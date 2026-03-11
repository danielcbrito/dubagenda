import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BarberRating {
  barberId: string;
  average: number;
  count: number;
}

/**
 * Hook para buscar médias de avaliação de barbeiros
 * com canal Realtime para atualizações instantâneas.
 */
export function useBarberRatings(barberIds: string[]) {
  const [ratings, setRatings] = useState<Record<string, BarberRating>>({});
  const [loading, setLoading] = useState(false);
  const barberIdsKey = barberIds.join(",");
  const loadRef = useRef(0);

  const loadRatings = useCallback(async () => {
    if (barberIds.length === 0) return;
    const token = ++loadRef.current;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("barbeiro_avaliacoes")
        .select("barber_id, rating")
        .in("barber_id", barberIds);

      if (error) throw error;
      if (token !== loadRef.current) return;

      const grouped: Record<string, { total: number; count: number }> = {};
      (data || []).forEach((row) => {
        if (!grouped[row.barber_id]) {
          grouped[row.barber_id] = { total: 0, count: 0 };
        }
        grouped[row.barber_id].total += row.rating;
        grouped[row.barber_id].count += 1;
      });

      const result: Record<string, BarberRating> = {};
      Object.entries(grouped).forEach(([barberId, { total, count }]) => {
        result[barberId] = {
          barberId,
          average: Math.round((total / count) * 10) / 10,
          count,
        };
      });

      setRatings(result);
    } catch (err) {
      console.error("Erro ao carregar avaliações:", err);
    } finally {
      if (token === loadRef.current) setLoading(false);
    }
  }, [barberIdsKey]);

  // Carga inicial
  useEffect(() => {
    loadRatings();
  }, [loadRatings]);

  // Canal Realtime — escuta INSERT em barbeiro_avaliacoes para os barberIds
  useEffect(() => {
    if (barberIds.length === 0) return;

    const channelName = `avaliacoes-${barberIds[0]}${barberIds.length > 1 ? `-plus${barberIds.length - 1}` : ""}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "barbeiro_avaliacoes",
        },
        (payload) => {
          const newRow = payload.new as { barber_id: string; rating: number };

          // Só processar se for de um dos barbeiros observados
          if (!barberIds.includes(newRow.barber_id)) return;

          console.log("[useBarberRatings] Nova avaliação recebida:", newRow.barber_id, newRow.rating);

          toast.success(`⭐ Nova avaliação recebida! ${newRow.rating}/5`);

          // Recarregar todas as avaliações para recalcular médias
          loadRatings();
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.error("[useBarberRatings] Erro no canal Realtime:", channelName);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [barberIdsKey, loadRatings]);

  return { ratings, loading };
}
