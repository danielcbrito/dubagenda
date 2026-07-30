import { useState } from "react";
import { cn } from "@/lib/utils";
import { User, Star, ChevronRight, Crown } from "lucide-react";
import { motion } from "framer-motion";
import { BarberProfileSheet } from "@/components/discover/BarberProfileSheet";

interface Barber {
  id: string;
  apelido: string;
  foto_url: string | null;
}

interface BarberRating {
  average: number;
  count: number;
}

interface BarberCardProps {
  barber: Barber;
  isSelected: boolean;
  onSelect: () => void;
  rating?: BarberRating | null;
  isPlanBarber?: boolean;
}

export function BarberCard({ barber, isSelected, onSelect, rating, isPlanBarber }: BarberCardProps) {
  const [showProfile, setShowProfile] = useState(false);

  const handleViewReviews = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowProfile(true);
  };

  return (
    <>
      <motion.button
        onClick={onSelect}
        whileTap={{ scale: 0.985 }}
        className={cn(
          "w-full text-left rounded-xl p-3.5 transition-all duration-200 relative group",
          "bg-card border",
          isSelected
            ? "border-primary/25 shadow-[0_2px_12px_-4px_hsl(var(--primary)/0.12)]"
            : "border-border/40 hover:border-border/80 hover:bg-card/80"
        )}
      >
        {/* Plan badge */}
        {isPlanBarber && (
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-secondary/10 text-secondary px-2 py-0.5 rounded-full border border-secondary/15">
            <Crown className="w-2.5 h-2.5" />
            <span className="text-[9px] font-semibold uppercase tracking-wider">Seu Plano</span>
          </div>
        )}

        <div className="flex items-center gap-3.5">
          {/* Avatar */}
          <div className={cn(
            "relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0 transition-all duration-200",
            isSelected ? "ring-[2px] ring-primary/20" : ""
          )}>
            {barber.foto_url ? (
              <img
                src={barber.foto_url}
                alt={barber.apelido}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-muted/30 flex items-center justify-center">
                <User className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className={cn(
              "text-[14px] font-semibold truncate transition-colors",
              isSelected ? "text-foreground" : "text-foreground"
            )}>
              {barber.apelido}
            </h3>

            {/* Rating */}
            {rating && rating.count > 0 ? (
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center gap-0.5 bg-muted/40 px-1.5 py-0.5 rounded-md">
                  <Star className="w-3 h-3 fill-primary text-primary" />
                  <span className="text-[11px] font-semibold text-foreground tabular-nums">
                    {rating.average.toFixed(1)}
                  </span>
                </div>
                <button
                  onClick={handleViewReviews}
                  className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors"
                >
                  <span>{rating.count} avaliações</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground mt-1">
                Profissional
              </p>
            )}
          </div>

          {/* Selection Indicator */}
          <div className={cn(
            "flex-shrink-0 w-6 h-6 rounded-full border transition-all duration-200 flex items-center justify-center",
            isSelected 
              ? "bg-primary border-primary"
              : "border-muted-foreground/30 group-hover:border-muted-foreground/50",
            isPlanBarber ? "mt-5" : ""
          )}>
            {isSelected && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2.5 6L5 8.5L9.5 4" stroke="hsl(var(--primary-foreground))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </motion.div>
            )}
          </div>
        </div>
      </motion.button>

      {/* Profile Sheet */}
      <BarberProfileSheet
        open={showProfile}
        onClose={() => setShowProfile(false)}
        barberId={barber.id}
        barberName={barber.apelido}
        barberPhoto={barber.foto_url}
        barberAvgRating={rating?.average ?? null}
        barberTotalReviews={rating?.count || 0}
      />
    </>
  );
}
