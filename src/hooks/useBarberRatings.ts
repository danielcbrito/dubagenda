import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface BarberRating {
  barberId: string;
  average: number;
  count: number;
}

/**
 * Hook para buscar médias de avaliação de barbeiros
 */
export function useBarberRatings(barberIds: string[]) {
  const [ratings, setRatings] = useState<Record<string, BarberRating>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (barberIds.length === 0) return;

    const loadRatings = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("barbeiro_avaliacoes")
          .select("barber_id, rating")
          .in("barber_id", barberIds);

        if (error) throw error;

        // Calcular médias por barbeiro
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
        setLoading(false);
      }
    };

    loadRatings();
  }, [barberIds.join(",")]);

  return { ratings, loading };
}
