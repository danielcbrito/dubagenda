import { cn } from "@/lib/utils";
import { User, Star } from "lucide-react";
import { motion } from "framer-motion";

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
  return (
    <motion.button
      onClick={onSelect}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "w-full text-left rounded-2xl p-5 transition-all duration-300 border",
        "bg-card hover:bg-secondary/50",
        isSelected
          ? "border-primary shadow-lg shadow-primary/20 ring-2 ring-primary/30"
          : "border-border hover:border-primary/50"
      )}
    >
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className={cn(
          "relative w-16 h-16 rounded-full overflow-hidden flex-shrink-0 transition-all duration-300",
          isSelected 
            ? "ring-2 ring-primary ring-offset-2 ring-offset-background" 
            : ""
        )}>
          {barber.foto_url ? (
            <img
              src={barber.foto_url}
              alt={barber.apelido}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-secondary flex items-center justify-center">
              <User className="w-8 h-8 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className={cn(
            "text-lg font-semibold truncate transition-colors",
            isSelected ? "text-primary" : "text-foreground"
          )}>
            {barber.apelido}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Profissional
          </p>
          {/* Rating */}
          {rating && rating.count > 0 && (
            <div className="flex items-center gap-1.5 mt-1">
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={cn(
                      "w-3.5 h-3.5",
                      star <= Math.round(rating.average)
                        ? "fill-primary text-primary"
                        : "text-muted-foreground/30"
                    )}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground font-medium">
                {rating.average.toFixed(1)} ({rating.count})
              </span>
            </div>
          )}
        </div>

        {/* Selection Indicator */}
        <div className={cn(
          "flex-shrink-0 w-6 h-6 rounded-full border-2 transition-all duration-200 flex items-center justify-center",
          isSelected 
            ? "bg-primary border-primary"
            : "border-muted-foreground/30"
        )}>
          {isSelected && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-2.5 h-2.5 rounded-full bg-primary-foreground"
            />
          )}
        </div>
      </div>
    </motion.button>
  );
}