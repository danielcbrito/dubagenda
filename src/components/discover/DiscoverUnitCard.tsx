import { MapPin, Footprints, Car, Star, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface UnitCardData {
  id: string;
  nome: string;
  brandName: string;
  brandLogo: string | null;
  brandSlug: string | null;
  bairro: string | null;
  cidade: string | null;
  rua: string | null;
  numero: string | null;
  travelMinutes: number | null;
  travelMode: "walking" | "driving" | null;
  is_sede: boolean;
}

interface DiscoverUnitCardProps {
  unit: UnitCardData;
  index: number;
  isSelected: boolean;
  onClick: () => void;
}

function formatTravelTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

export function DiscoverUnitCard({
  unit,
  index,
  isSelected,
  onClick,
}: DiscoverUnitCardProps) {
  const brandInitial = unit.brandName?.[0]?.toUpperCase() ?? "?";
  const address = [unit.rua, unit.numero].filter(Boolean).join(", ");
  const locality = [unit.bairro, unit.cidade].filter(Boolean).join(" · ");

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-2xl overflow-hidden border transition-all duration-200",
        "active:scale-[0.98]",
        isSelected
          ? "border-foreground/80 shadow-lg ring-1 ring-foreground/10"
          : "border-border/60 shadow-sm"
      )}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {/* Header band with logo */}
      <div className="relative h-28 bg-secondary/40 overflow-hidden">
        {unit.brandLogo ? (
          <img
            src={unit.brandLogo}
            alt={unit.brandName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-secondary">
            <span className="text-3xl font-bold text-muted-foreground/30">
              {brandInitial}
            </span>
          </div>
        )}

        {/* Travel badge */}
        {unit.travelMinutes !== null && unit.travelMode && (
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-card/90 backdrop-blur-md text-foreground rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-md border border-border/40">
            {unit.travelMode === "walking" ? (
              <Footprints className="w-3 h-3" />
            ) : (
              <Car className="w-3 h-3" />
            )}
            {formatTravelTime(unit.travelMinutes)}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3.5 bg-card space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[15px] font-bold text-foreground leading-tight line-clamp-1">
            {unit.brandName}
          </h3>
        </div>

        {(address || locality) && (
          <div className="flex items-start gap-1.5">
            <MapPin className="w-3 h-3 text-muted-foreground/50 mt-0.5 shrink-0" />
            <div className="flex flex-col">
              {address && (
                <span className="text-[12px] text-muted-foreground/70 leading-tight line-clamp-1">
                  {address}
                </span>
              )}
              {locality && (
                <span className="text-[11px] text-muted-foreground/50 leading-tight">
                  {locality}
                </span>
              )}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="pt-1">
          <div
            className={cn(
              "w-full h-9 rounded-xl flex items-center justify-center text-[12px] font-semibold transition-colors",
              isSelected
                ? "bg-foreground text-background"
                : "bg-secondary text-foreground"
            )}
          >
            Ver horários disponíveis
          </div>
        </div>
      </div>
    </motion.button>
  );
}
