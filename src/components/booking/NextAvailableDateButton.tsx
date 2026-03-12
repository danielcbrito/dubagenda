import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ArrowRight, Loader2 } from "lucide-react";

interface NextAvailableDateButtonProps {
  selectedDate: Date | null;
  barberId: string | undefined;
  onSelectDate: (date: Date) => void;
}

export function NextAvailableDateButton({
  selectedDate,
  barberId,
  onSelectDate,
}: NextAvailableDateButtonProps) {
  const [searching, setSearching] = useState(false);
  const [nextDate, setNextDate] = useState<Date | null>(null);

  useEffect(() => {
    if (!selectedDate || !barberId) return;

    let cancelled = false;
    setSearching(true);
    setNextDate(null);

    supabase
      .rpc("get_next_available_date", {
        p_barbeiro_id: barberId,
        p_data_inicio: format(selectedDate, "yyyy-MM-dd"),
        p_dias_limite: 45,
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) {
          setNextDate(new Date(data + "T00:00:00"));
        } else {
          setNextDate(null);
        }
        setSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDate, barberId]);

  if (searching) {
    return (
      <span className="text-sm text-muted-foreground flex items-center gap-1.5">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Buscando próxima data...
      </span>
    );
  }

  if (!nextDate) return null;

  return (
    <button
      onClick={() => onSelectDate(nextDate)}
      className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
    >
      Próxima data com horário livre ({format(nextDate, "dd/MM")})
      <ArrowRight className="w-3.5 h-3.5" />
    </button>
  );
}
