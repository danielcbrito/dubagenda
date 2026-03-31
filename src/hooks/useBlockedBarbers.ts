import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches the list of barber IDs that the current user is blocked from.
 * Returns an empty array if not authenticated or no blocks exist.
 */
export function useBlockedBarbers() {
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetch = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("bloqueios_cliente_barbeiro" as any)
        .select("barbeiro_id")
        .eq("user_id", user.id);

      if (!cancelled) {
        setBlockedIds((data || []).map((r: any) => r.barbeiro_id));
        setLoading(false);
      }
    };

    fetch();
    return () => { cancelled = true; };
  }, []);

  return { blockedIds, loading };
}
