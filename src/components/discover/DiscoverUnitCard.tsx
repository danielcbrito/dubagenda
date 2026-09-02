import { MapPin, Footprints, Car } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { getDiscoverUnitFullName } from "./discoverUnitUtils";

interface UnitCardData {
  id: string;
  nome: string;
  brandName: string;
  brandLogo: string | null;
  brandSlug: string | null;
  bannerUrl: string | null;
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
  const title = getDiscoverUnitFullName(unit.brandName, unit.nome);
  const address = [unit.rua, unit.numero].filter(Boolean).join(", ");
  const locality = [unit.bairro, unit.cidade].filter(Boolean).join(" · ");
  const heroImage = unit.bannerUrl || unit.brandLogo;

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      className={cn(
        "w-full overflow-hidden rounded-2xl border text-left transition-all duration-200",
        "active:scale-[0.98]",
        isSelected
          ? "border-foreground/80 shadow-lg ring-1 ring-foreground/10"
          : "border-border/60 shadow-sm"
      )}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {/* Banner */}
      <div className="relative h-28 overflow-hidden bg-secondary/40">
        {heroImage ? (
          <img
            src={heroImage}
            alt={title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-secondary">
            <span className="text-3xl font-bold text-muted-foreground/30">
              {brandInitial}
            </span>
          </div>
        )}

        {unit.travelMinutes !== null && unit.travelMode && (
          <div className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full border border-border/40 bg-card/90 px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-md backdrop-blur-md">
            {unit.travelMode === "walking" ? (
              <Footprints className="h-3 w-3" />
            ) : (
              <Car className="h-3 w-3" />
            )}
            {formatTravelTime(unit.travelMinutes)}
          </div>
        )}
      </div>

      {/* Content with logo on the right */}
      <div className="relative bg-card px-3.5 pt-2.5 pb-3">
        <div className="flex items-start gap-3">
          {/* Text info — left */}
          <div className="flex-1 min-w-0 space-y-1">
            <h3 className="line-clamp-2 text-[14px] font-bold leading-tight text-foreground">
              {title}
            </h3>
            {!unit.is_sede && (
              <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/60">
                Unidade independente
              </p>
            )}
            {(address || locality) && (
              <div className="flex items-start gap-1.5">
                <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/40" />
                <div className="flex flex-col">
                  {address && (
                    <span className="line-clamp-1 text-[11px] leading-tight text-muted-foreground/60">
                      {address}
                    </span>
                  )}
                  {locality && (
                    <span className="text-[10px] leading-tight text-muted-foreground/40">
                      {locality}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Logo circle — right, bigger */}
          <div className="relative -mt-8 h-14 w-14 flex-shrink-0 overflow-hidden rounded-full border-[3px] border-card bg-secondary shadow-lg">
            {unit.brandLogo ? (
              <img
                src={unit.brandLogo}
                alt={unit.brandName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-secondary">
                <span className="text-lg font-bold text-muted-foreground/40">
                  {brandInitial}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.button>
  );
}
