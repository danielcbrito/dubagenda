import { cn } from "@/lib/utils";
import { User, Star, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

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
}

export function BarberCard({ barber, isSelected, onSelect, rating }: BarberCardProps) {
  const navigate = useNavigate();

  const handleViewReviews = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/cliente/barbeiro/${barber.id}/avaliacoes`);
  };

  return (
    <motion.button
      onClick={onSelect}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "w-full text-left rounded-lg p-3 transition-all duration-200 border",
        "bg-card/60 active:scale-[0.99]",
        isSelected
          ? "border-primary/40 bg-primary/5"
          : "border-border/25 hover:border-border/50"
      )}
    >
      <div className="flex items-center gap-2.5">
        {/* Avatar */}
        <div className={cn(
          "relative w-9 h-9 rounded-full overflow-hidden flex-shrink-0 transition-all duration-200",
          isSelected ? "ring-[1.5px] ring-primary/50 ring-offset-1 ring-offset-background" : ""
        )}>
          {barber.foto_url ? (
            <img
              src={barber.foto_url}
              alt={barber.apelido}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-muted/20 flex items-center justify-center">
              <User className="w-5 h-5 text-muted-foreground/40" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className={cn(
            "text-[13px] font-semibold truncate transition-colors",
            isSelected ? "text-primary" : "text-foreground/80"
          )}>
            {barber.apelido}
          </h3>

          {/* Rating */}
          {rating && rating.count > 0 ? (
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="flex gap-px">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={cn(
                      "w-2.5 h-2.5",
                      star <= Math.round(rating.average)
                        ? "fill-primary/70 text-primary/70"
                        : "text-muted-foreground/15"
                    )}
                  />
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground/50 tabular-nums">
                {rating.average.toFixed(1)}
              </span>
              <button
                onClick={handleViewReviews}
                className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground/70 flex items-center gap-0.5 transition-colors ml-0.5"
              >
                <span>{rating.count} avaliações</span>
                <ChevronRight className="w-2.5 h-2.5" />
              </button>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground/30 mt-0.5">
              Profissional
            </p>
          )}
        </div>

        {/* Selection Indicator */}
        <div className={cn(
          "flex-shrink-0 w-5 h-5 rounded-full border-[1.5px] transition-all duration-200 flex items-center justify-center",
          isSelected 
            ? "bg-primary border-primary"
            : "border-muted-foreground/20"
        )}>
          {isSelected && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-2 h-2 rounded-full bg-primary-foreground"
            />
          )}
        </div>
      </div>
    </motion.button>
  );
}
