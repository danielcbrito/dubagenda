import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface BarberRating {
  barberId: string;
  average: number;
  count: number;
}

/**
 * Hook para buscar médias de avaliação de barbeiros.
 * Carrega ratings quando os barberIds mudam — sem Realtime.
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

  // Carga quando barberIds mudam
  useEffect(() => {
    loadRatings();
  }, [loadRatings]);

  return { ratings, loading };
}
