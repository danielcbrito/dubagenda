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
        type="button"
        onClick={onSelect}
        whileTap={{ scale: 0.985 }}
        className={cn(
          "w-full text-left rounded-[24px] p-4 transition-all duration-300 relative group cursor-pointer",
          isSelected
            ? "border-neutral-900 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.08)] ring-1 ring-neutral-900"
            : "bg-white border border-neutral-200/80 hover:border-neutral-300 shadow-[0_2px_12px_rgba(0,0,0,0.03)]"
        )}
      >
        {/* Plan badge */}
        {isPlanBarber && (
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-secondary/10 text-secondary px-2 py-0.5 rounded-full border border-secondary/15">
            <Crown className="w-2.5 h-2.5" />
            <span className="text-[9px] font-medium">Seu Plano</span>
          </div>
        )}

        <div className="flex items-center gap-3.5">
          {/* Avatar */}
          <div className={cn(
            "relative w-[56px] h-[56px] rounded-full overflow-hidden flex-shrink-0 transition-all duration-300",
            isSelected
              ? "shadow-[0_0_0_2px_#171717]"
              : "ring-1 ring-neutral-100"
          )}>
            {barber.foto_url ? (
              <img
                src={barber.foto_url}
                alt={barber.apelido}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-neutral-100 flex items-center justify-center">
                <User className="w-5 h-5 text-neutral-400" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-medium text-neutral-900 truncate transition-colors">
              {barber.apelido}
            </h3>

            {/* Rating */}
            {rating && rating.count > 0 ? (
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center gap-1 bg-neutral-100 px-2 py-0.5 rounded-full">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span className="text-[12px] font-medium text-neutral-900 tabular-nums">
                    {rating.average.toFixed(1)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleViewReviews}
                  className="text-[12px] font-medium text-neutral-500 hover:text-neutral-900 flex items-center gap-0.5 transition-colors"
                >
                  <span>{rating.count} avaliações</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <p className="text-[12px] font-medium text-neutral-500 mt-1">
                Profissional disponível
              </p>
            )}
          </div>

          {/* Selection indicator */}
          <div className={cn(
            "flex-shrink-0 w-6 h-6 rounded-full border-2 transition-all duration-300 flex items-center justify-center",
            isSelected 
              ? "bg-neutral-900 border-neutral-900"
              : "border-neutral-200 group-hover:border-neutral-300"
          )}>
            {isSelected && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6L5 8.5L9.5 4" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
        </div>
      </motion.button>

      {/* Barber Profile Sheet */}
      <BarberProfileSheet
        open={showProfile}
        onOpenChange={setShowProfile}
        barberId={barber.id}
        barberName={barber.apelido}
        barberPhoto={barber.foto_url}
      />
    </>
  );
}
