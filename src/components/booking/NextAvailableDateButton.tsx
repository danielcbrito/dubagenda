import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { addDays, format } from "date-fns";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NextAvailableDateButtonProps {
  selectedDate: Date | null;
  barberId: string | undefined;
  serviceDuration: number;
  tenantId?: string | null;
  onSelectDate: (date: Date) => void;
}

export function NextAvailableDateButton({
  selectedDate,
  barberId,
  serviceDuration,
  tenantId,
  onSelectDate,
}: NextAvailableDateButtonProps) {
  const [searching, setSearching] = useState(false);
  const [nextDate, setNextDate] = useState<Date | null>(null);

  useEffect(() => {
    if (!selectedDate || !barberId || serviceDuration <= 0) return;

    let cancelled = false;
    setSearching(true);
    setNextDate(null);

    const findNextDate = async () => {
      for (let offset = 1; offset <= 45 && !cancelled; offset += 5) {
        const candidates = Array.from({ length: Math.min(5, 46 - offset) }, (_, index) =>
          addDays(selectedDate, offset + index)
        );
        const results = await Promise.all(candidates.map(async (candidate) => {
          const { data, error } = await supabase.functions.invoke("check-availability", {
            body: {
              date: format(candidate, "yyyy-MM-dd"),
              duration: serviceDuration,
              barbeiroId: barberId,
              tenantId,
            },
          });
          const payload = data?.data ?? data;
          return !error && Array.isArray(payload?.slots) && payload.slots.some((slot: { available?: boolean }) => slot.available);
        }));
        const availableIndex = results.findIndex(Boolean);
        if (availableIndex >= 0) {
          if (!cancelled) setNextDate(candidates[availableIndex]);
          break;
        }
      }
      if (!cancelled) {
        setSearching(false);
      }
    };

    void findNextDate();

    return () => {
      cancelled = true;
    };
  }, [selectedDate, barberId, serviceDuration, tenantId]);

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
    <Button
      type="button"
      variant="ghost"
      onClick={() => onSelectDate(nextDate)}
      className="h-auto px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
    >
      Próxima data com horário livre ({format(nextDate, "dd/MM")})
      <ArrowRight className="w-3.5 h-3.5" />
    </Button>
  );
}
