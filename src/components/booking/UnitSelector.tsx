import { useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Check, Pin, PinOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Unit {
  id: string;
  nome: string;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  is_sede: boolean | null;
}

interface UnitSelectorProps {
  units: Unit[];
  selectedUnit: Unit | null;
  preferredUnitId: string | null;
  userId: string | null;
  onSelect: (unit: Unit) => void;
  onPreferredChange: (unitId: string | null) => void;
}

/** Seletor de unidade premium — estilo card com opção de fixar */
export function UnitSelector({
  units,
  selectedUnit,
  preferredUnitId,
  userId,
  onSelect,
  onPreferredChange,
}: UnitSelectorProps) {
  const [savingPreferred, setSavingPreferred] = useState<string | null>(null);

  const handleTogglePreferred = async (e: React.MouseEvent, unit: Unit) => {
    e.stopPropagation();
    if (!userId) return;

    setSavingPreferred(unit.id);
    try {
      const isCurrentlyPreferred = preferredUnitId === unit.id;
      const newPreferredId = isCurrentlyPreferred ? null : unit.id;

      const { error } = await supabase
        .from("profiles")
        .update({ unidade_preferida_id: newPreferredId } as any)
        .eq("id", userId);

      if (error) throw error;

      onPreferredChange(newPreferredId);
      toast.success(
        isCurrentlyPreferred
          ? "Unidade desafixada. Você escolherá a unidade a cada agendamento."
          : `${unit.nome} definida como unidade fixa!`
      );
    } catch (err) {
      console.error("Error setting preferred unit:", err);
      toast.error("Erro ao salvar preferência");
    } finally {
      setSavingPreferred(null);
    }
  };

  const getLocationLabel = (unit: Unit) => {
    const parts = [unit.bairro, unit.cidade, unit.estado].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : null;
  };

  return (
    <div className="space-y-2.5">
      {units.map((unit, index) => {
        const isSelected = selectedUnit?.id === unit.id;
        const isPreferred = preferredUnitId === unit.id;
        const location = getLocationLabel(unit);

        return (
          <motion.button
            key={unit.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            onClick={() => onSelect(unit)}
            className={cn(
              "w-full text-left rounded-xl border p-3.5 transition-all",
              "active:scale-[0.99]",
              isSelected
                ? "border-primary/40 bg-primary/5 dark:bg-primary/8"
                : "border-border/30 bg-card/60 dark:bg-card/40 hover:border-border/50"
            )}
          >
            <div className="flex items-center gap-3">
              {/* Icon */}
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
                  isSelected
                    ? "bg-primary/15 text-primary"
                    : "bg-muted/40 text-muted-foreground/50"
                )}
              >
                <MapPin className="w-5 h-5" strokeWidth={1.8} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-[14px] font-semibold truncate",
                      isSelected ? "text-foreground" : "text-foreground/80"
                    )}
                  >
                    {unit.nome}
                  </span>
                  {unit.is_sede && (
                    <span className="text-[8px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded flex-shrink-0">
                      Sede
                    </span>
                  )}
                  {isPreferred && (
                    <span className="text-[8px] font-bold uppercase tracking-wider bg-secondary/20 text-secondary-foreground px-1.5 py-0.5 rounded flex-shrink-0">
                      Fixa
                    </span>
                  )}
                </div>
                {location && (
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5 truncate">
                    {location}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Fixar/Desafixar */}
                <button
                  onClick={(e) => handleTogglePreferred(e, unit)}
                  disabled={savingPreferred === unit.id}
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                    "active:scale-90",
                    isPreferred
                      ? "bg-primary/15 text-primary"
                      : "bg-muted/30 text-muted-foreground/40 hover:text-muted-foreground/60"
                  )}
                  title={isPreferred ? "Desafixar unidade" : "Fixar como padrão"}
                >
                  {savingPreferred === unit.id ? (
                    <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  ) : isPreferred ? (
                    <PinOff className="w-3.5 h-3.5" />
                  ) : (
                    <Pin className="w-3.5 h-3.5" />
                  )}
                </button>

                {/* Check de seleção */}
                <div
                  className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                    isSelected
                      ? "bg-primary border-primary"
                      : "border-border/40"
                  )}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={3} />}
                </div>
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
