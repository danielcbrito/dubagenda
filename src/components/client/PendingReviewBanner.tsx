import { Star, User, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PendingReviewBannerProps {
  barberName: string;
  barberPhoto: string | null;
  serviceName: string;
  date: string;
  onReview: () => void;
}

export function PendingReviewBanner({
  barberName,
  barberPhoto,
  serviceName,
  date,
  onReview,
}: PendingReviewBannerProps) {
  const formattedDate = format(
    new Date(`${date}T12:00:00`),
    "dd 'de' MMM",
    { locale: ptBR }
  );

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onReview}
      className="w-full rounded-2xl p-4 text-left transition-all duration-300 border border-primary/20 bg-primary/5 hover:bg-primary/10"
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary/30 flex-shrink-0">
          {barberPhoto ? (
            <img
              src={barberPhoto}
              alt={barberName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-primary/15 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Avalie seu atendimento
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {serviceName} com {barberName} - {formattedDate}
          </p>
          <div className="flex gap-0.5 mt-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className="w-3.5 h-3.5 text-muted-foreground/30"
              />
            ))}
          </div>
        </div>

        <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
      </div>
    </motion.button>
  );
}
