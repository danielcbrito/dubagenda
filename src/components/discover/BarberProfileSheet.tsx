import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, MessageSquare, Scissors, Loader2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PortfolioGallery } from "@/components/portfolio/PortfolioGallery";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  reviewer_first_name: string;
  created_at: string;
}

interface BarberProfileSheetProps {
  open: boolean;
  onClose: () => void;
  barberId: string | null;
  barberName: string;
  barberPhoto: string | null;
  barberAvgRating: number | null;
  barberTotalReviews: number;
}

function BackArrow() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10a4 4 0 0 1 4 4v1" />
    </svg>
  );
}

export function BarberProfileSheet({
  open, onClose, barberId, barberName, barberPhoto,
  barberAvgRating, barberTotalReviews,
}: BarberProfileSheetProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !barberId) return;
    loadReviews();
  }, [open, barberId]);

  const loadReviews = async () => {
    if (!barberId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("barbeiro_avaliacoes")
        .select("id, rating, comment, reviewer_first_name, created_at")
        .eq("barber_id", barberId)
        .order("created_at", { ascending: false });
      setReviews(data || []);
    } catch (err) {
      console.error("Error loading reviews:", err);
    } finally {
      setLoading(false);
    }
  };

  const ratingDistribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
    percent: reviews.length > 0
      ? (reviews.filter((r) => r.rating === star).length / reviews.length) * 100
      : 0,
  }));

  const avgRating = barberAvgRating ?? (reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, x: "100%" }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: "100%" }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[60] flex flex-col bg-background"
        >
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-8">

            {/* ── Hero Section ── */}
            <div className="relative w-full" style={{ minHeight: barberPhoto ? 300 : 200 }}>
              {barberPhoto ? (
                <>
                  <img
                    src={barberPhoto}
                    alt={barberName}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background: "linear-gradient(to bottom, transparent 0%, transparent 40%, hsl(var(--background) / 0.5) 70%, hsl(var(--background)) 100%)"
                    }}
                  />
                </>
              ) : (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{
                    background: "linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)"
                  }}
                >
                  <div className="w-24 h-24 rounded-full bg-muted/30 border border-border/20 flex items-center justify-center">
                    <User className="w-10 h-10 text-muted-foreground/40" />
                  </div>
                </div>
              )}

              {/* Back button */}
              <button
                onClick={onClose}
                className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] left-3 z-10 w-10 h-10 flex items-center justify-center rounded-lg bg-background/60 backdrop-blur-md border border-border/30 active:scale-95 transition-all text-foreground"
              >
                <BackArrow />
              </button>
            </div>

            {/* ── Name + Rating Summary ── */}
            <div className="px-5 pt-5 pb-4">
              <h1 className="text-[22px] font-bold font-display text-foreground tracking-tight">
                {barberName}
              </h1>

              <div className="flex items-center gap-2.5 mt-2">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={cn(
                        "w-4 h-4",
                        star <= Math.round(avgRating)
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground/20"
                      )}
                    />
                  ))}
                </div>
                {barberTotalReviews > 0 && (
                  <span className="text-[13px] font-bold tabular-nums text-foreground">
                    {avgRating.toFixed(1)}
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground">
                  {barberTotalReviews > 0
                    ? `${barberTotalReviews} ${barberTotalReviews === 1 ? "avaliação" : "avaliações"}`
                    : "Sem avaliações"}
                </span>
              </div>
            </div>

            {/* ── Portfolio ── */}
            {barberId && (
              <div className="pt-1">
                <PortfolioGallery
                  barberIds={[barberId]}
                  barberMap={new Map([[barberId, { name: barberName, photo: barberPhoto }]])}
                  maxVisible={6}
                  showAttribution={false}
                />
              </div>
            )}

            {/* ── Rating Distribution ── */}
            {!loading && reviews.length > 0 && (
              <div className="px-5 pb-5">
                <div className="rounded-xl bg-card border border-border/30 p-4">
                  <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground font-bold mb-3">
                    Distribuição
                  </p>
                  <div className="space-y-2">
                    {ratingDistribution.map(({ star, count, percent }) => (
                      <div key={star} className="flex items-center gap-2.5">
                        <span className="text-[10px] tabular-nums text-muted-foreground w-3 text-right font-medium">
                          {star}
                        </span>
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <div className="flex-1 h-[6px] rounded-full bg-muted/40 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percent}%` }}
                            transition={{ delay: 0.15, duration: 0.5, ease: "easeOut" }}
                            className="h-full rounded-full bg-amber-400"
                          />
                        </div>
                        <span className="text-[10px] tabular-nums text-muted-foreground/60 w-4 text-right">
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Reviews List ── */}
            <div className="px-5">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-3.5 h-3.5 text-muted-foreground/50" />
                <h3 className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground font-bold">
                  Avaliações
                </h3>
                {!loading && reviews.length > 0 && (
                  <span className="text-[9px] tabular-nums text-muted-foreground/50 font-medium">
                    {reviews.length}
                  </span>
                )}
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                </div>
              ) : reviews.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center py-12"
                >
                  <Scissors className="w-5 h-5 text-muted-foreground/15 mb-2" />
                  <p className="text-[12px] text-muted-foreground/50">
                    Nenhuma avaliação ainda
                  </p>
                </motion.div>
              ) : (
                <div className="space-y-2.5">
                  {reviews.map((review, i) => (
                    <motion.div
                      key={review.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="rounded-xl bg-card border border-border/30 p-3.5"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-muted/40 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-foreground/60">
                              {review.reviewer_first_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="text-[12px] font-semibold text-foreground">
                            {review.reviewer_first_name}
                          </span>
                        </div>
                        <span className="text-[9px] text-muted-foreground">
                          {format(new Date(review.created_at), "dd MMM yyyy", { locale: ptBR })}
                        </span>
                      </div>

                      <div className="flex gap-0.5 mb-1.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={cn(
                              "w-3 h-3",
                              star <= review.rating
                                ? "fill-amber-400 text-amber-400"
                                : "text-muted-foreground/20"
                            )}
                          />
                        ))}
                      </div>

                      {review.comment && (
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {review.comment}
                        </p>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
